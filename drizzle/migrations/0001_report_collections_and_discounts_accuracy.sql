CREATE OR REPLACE FUNCTION public.report_overview(p_from timestamptz, p_to timestamptz, p_group text DEFAULT 'day') RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_to <= p_from OR p_to-p_from > interval '3660 days' OR p_group NOT IN ('day','week','month') THEN RAISE EXCEPTION 'INVALID_REPORT_RANGE'; END IF;
 WITH completed AS MATERIALIZED (SELECT * FROM public.sales WHERE created_at >= p_from AND created_at < p_to AND sale_status='COMPLETED'),
 eligible AS MATERIALIZED (SELECT * FROM completed WHERE payment_status NOT IN ('FAILED','REFUNDED')),
 paid AS MATERIALIZED (SELECT * FROM eligible WHERE payment_status='PAID'),
 pay AS (SELECT p.* FROM public.payments p JOIN public.sales s ON s.id=p.sale_id WHERE s.sale_status='COMPLETED' AND s.payment_status NOT IN ('FAILED','REFUNDED') AND p.created_at>=p_from AND p.created_at<p_to),
 payment_groups AS (SELECT payment_method method,payment_status status,count(*) count,sum(amount)::text amount,coalesce(sum(amount) FILTER(WHERE payment_status='PAID'),0)::text collected FROM pay GROUP BY payment_method,payment_status),
 buckets AS (SELECT generate_series(date_trunc(p_group,p_from AT TIME ZONE 'Africa/Nairobi'),date_trunc(p_group,(p_to-interval '1 microsecond') AT TIME ZONE 'Africa/Nairobi'), CASE p_group WHEN 'month' THEN interval '1 month' WHEN 'week' THEN interval '1 week' ELSE interval '1 day' END) d),
 trends AS (SELECT date_trunc(p_group,created_at AT TIME ZONE 'Africa/Nairobi') d,sum(total_amount) revenue,count(*) count FROM paid GROUP BY 1)
 SELECT jsonb_build_object(
 'sales',(SELECT jsonb_build_object('revenue',coalesce(sum(total_amount),0)::text,'count',count(*),'average',coalesce(round(avg(total_amount),2),0)::text,'discounts',(coalesce(sum(discount_amount),0)+(SELECT coalesce(sum(i.discount_amount),0) FROM public.sale_items i JOIN paid s ON s.id=i.sale_id))::text,'tax',coalesce(sum(tax_amount),0)::text,'walk_in_count',count(*) FILTER(WHERE customer_id IS NULL),'walk_in_revenue',coalesce(sum(total_amount) FILTER(WHERE customer_id IS NULL),0)::text,'pending',(SELECT coalesce(sum(total_amount),0)::text FROM eligible WHERE payment_status='PENDING')) FROM paid),
 'inventory',(SELECT jsonb_build_object('total',count(*),'active',count(*) FILTER(WHERE is_active),'inactive',count(*) FILTER(WHERE NOT is_active),'in_stock',count(*) FILTER(WHERE stock_quantity>low_stock_threshold),'low',count(*) FILTER(WHERE stock_quantity>0 AND stock_quantity<=low_stock_threshold),'out',count(*) FILTER(WHERE stock_quantity<=0),'estimated_value',coalesce(round(sum(stock_quantity*cost_price),2),0)::text) FROM public.products),
 'customers',(SELECT jsonb_build_object('total',count(*),'active',count(*) FILTER(WHERE is_active),'inactive',count(*) FILTER(WHERE NOT is_active),'purchasing',(SELECT count(DISTINCT customer_id) FROM paid)) FROM public.customers),
 'trend',(SELECT coalesce(jsonb_agg(jsonb_build_object('date',to_char(b.d,'YYYY-MM-DD'),'revenue',coalesce(t.revenue,0)::text,'count',coalesce(t.count,0)) ORDER BY b.d),'[]'::jsonb) FROM buckets b LEFT JOIN trends t USING(d)),
 'payments',(SELECT coalesce(jsonb_agg(to_jsonb(pg) ORDER BY method,status),'[]'::jsonb) FROM payment_groups pg),
 'categories',(SELECT coalesce(jsonb_agg(category ORDER BY category),'[]'::jsonb) FROM (SELECT DISTINCT category FROM public.products WHERE category IS NOT NULL AND category<>'') c)
 ) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.report_overview(timestamptz,timestamptz,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.report_overview(timestamptz,timestamptz,text) TO authenticated;