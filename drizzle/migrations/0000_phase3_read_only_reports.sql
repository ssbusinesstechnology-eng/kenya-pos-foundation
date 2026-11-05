CREATE OR REPLACE FUNCTION public.report_overview(p_from timestamptz, p_to timestamptz, p_group text DEFAULT 'day') RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_to <= p_from OR p_to-p_from > interval '3660 days' OR p_group NOT IN ('day','week','month') THEN RAISE EXCEPTION 'INVALID_REPORT_RANGE'; END IF;
 WITH completed AS MATERIALIZED (SELECT * FROM public.sales WHERE created_at >= p_from AND created_at < p_to AND sale_status='COMPLETED'),
 eligible AS MATERIALIZED (SELECT * FROM completed WHERE payment_status NOT IN ('FAILED','REFUNDED')),
 paid AS MATERIALIZED (SELECT * FROM eligible WHERE payment_status='PAID'),
 pay AS (SELECT p.* FROM public.payments p JOIN eligible s ON s.id=p.sale_id WHERE p.created_at>=p_from AND p.created_at<p_to),
 payment_groups AS (SELECT payment_method method,payment_status status,count(*) count,sum(amount)::text amount,coalesce(sum(amount) FILTER(WHERE payment_status='PAID'),0)::text collected FROM pay GROUP BY payment_method,payment_status),
 buckets AS (SELECT generate_series(date_trunc(p_group,p_from AT TIME ZONE 'Africa/Nairobi'),date_trunc(p_group,(p_to-interval '1 microsecond') AT TIME ZONE 'Africa/Nairobi'), CASE p_group WHEN 'month' THEN interval '1 month' WHEN 'week' THEN interval '1 week' ELSE interval '1 day' END) d),
 trends AS (SELECT date_trunc(p_group,created_at AT TIME ZONE 'Africa/Nairobi') d,sum(total_amount) revenue,count(*) count FROM paid GROUP BY 1)
 SELECT jsonb_build_object(
 'sales',(SELECT jsonb_build_object('revenue',coalesce(sum(total_amount),0)::text,'count',count(*),'average',coalesce(round(avg(total_amount),2),0)::text,'discounts',coalesce(sum(discount_amount),0)::text,'tax',coalesce(sum(tax_amount),0)::text,'walk_in_count',count(*) FILTER(WHERE customer_id IS NULL),'walk_in_revenue',coalesce(sum(total_amount) FILTER(WHERE customer_id IS NULL),0)::text,'pending',(SELECT coalesce(sum(total_amount),0)::text FROM eligible WHERE payment_status='PENDING')) FROM paid),
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

CREATE OR REPLACE FUNCTION public.report_details(p_from timestamptz,p_to timestamptz,p_section text,p_search text DEFAULT '',p_category text DEFAULT '',p_stock text DEFAULT 'ALL',p_sort text DEFAULT 'revenue',p_page integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_to<=p_from OR p_to-p_from>interval '3660 days' OR p_page<0 OR p_page>100000 OR length(p_search)>120 OR p_section NOT IN ('top','performance','inventory','movements','customers','transactions') OR p_sort NOT IN ('revenue','quantity') OR p_stock NOT IN ('ALL','IN','LOW','OUT') THEN RAISE EXCEPTION 'INVALID_REPORT_FILTER'; END IF;
 WITH paid AS MATERIALIZED (SELECT * FROM public.sales WHERE created_at>=p_from AND created_at<p_to AND sale_status='COMPLETED' AND payment_status='PAID'),
 item_groups AS (SELECT i.product_id,i.product_name name,i.product_sku sku,i.unit,sum(i.quantity) quantity,sum(i.line_subtotal) revenue,count(DISTINCT i.sale_id) transactions FROM public.sale_items i JOIN paid s ON s.id=i.sale_id GROUP BY i.product_id,i.product_name,i.product_sku,i.unit),
 product_totals AS (SELECT product_id,sum(quantity) quantity,sum(revenue) revenue FROM item_groups GROUP BY product_id),
 product_counts AS (SELECT i.product_id,count(DISTINCT i.sale_id) transactions FROM public.sale_items i JOIN paid s ON s.id=i.sale_id GROUP BY i.product_id),
 products AS (SELECT p.*,CASE WHEN stock_quantity<=0 THEN 'OUT' WHEN stock_quantity<=low_stock_threshold THEN 'LOW' ELSE 'IN' END stock FROM public.products p),
 customer_totals AS (SELECT customer_id,count(*) transactions,sum(total_amount) revenue FROM paid GROUP BY customer_id),
 all_rows AS (
 SELECT jsonb_build_object('id',g.product_id,'name',g.name,'sku',g.sku,'unit',g.unit,'quantity',g.quantity::text,'revenue',g.revenue::text,'transactions',g.transactions) row,g.name label,g.revenue revenue,g.quantity quantity,NULL::timestamptz happened FROM item_groups g WHERE p_section='top' AND (p_search='' OR g.name ILIKE '%'||p_search||'%' OR g.sku ILIKE '%'||p_search||'%')
 UNION ALL
 SELECT jsonb_build_object('id',p.id,'name',p.name,'sku',p.sku,'category',p.category,'unit',p.unit,'active',p.is_active,'quantity',coalesce(t.quantity,0)::text,'revenue',coalesce(t.revenue,0)::text,'transactions',coalesce(pc.transactions,0),'stock',p.stock,'current_stock',p.stock_quantity::text,'threshold',p.low_stock_threshold,'cost',p.cost_price::text,'price',p.selling_price::text),p.name,coalesce(t.revenue,0),coalesce(t.quantity,0),NULL::timestamptz FROM products p LEFT JOIN product_totals t ON t.product_id=p.id LEFT JOIN product_counts pc ON pc.product_id=p.id WHERE p_section IN ('performance','inventory') AND (p_search='' OR p.name ILIKE '%'||p_search||'%' OR p.sku ILIKE '%'||p_search||'%') AND (p_category='' OR p.category=p_category) AND (p_stock='ALL' OR p.stock=p_stock)
 UNION ALL
 SELECT jsonb_build_object('id',m.id,'name',p.name,'sku',p.sku,'unit',p.unit,'type',m.movement_type,'change',m.quantity_change::text,'before',m.previous_stock::text,'after',m.new_stock::text,'reason',m.reason,'staff',coalesce(pr.full_name,CASE WHEN m.created_by=auth.uid() THEN 'You' ELSE 'Staff' END),'date',m.created_at),p.name,0,0,m.created_at FROM public.inventory_movements m JOIN public.products p ON p.id=m.product_id LEFT JOIN public.profiles pr ON pr.id=m.created_by WHERE p_section='movements' AND m.created_at>=p_from AND m.created_at<p_to AND (p_search='' OR p.name ILIKE '%'||p_search||'%' OR p.sku ILIKE '%'||p_search||'%')
 UNION ALL
 SELECT jsonb_build_object('id',c.id,'name',c.name,'phone',c.phone,'active',c.is_active,'transactions',coalesce(t.transactions,0),'revenue',coalesce(t.revenue,0)::text),c.name,coalesce(t.revenue,0),0,NULL::timestamptz FROM public.customers c LEFT JOIN customer_totals t ON t.customer_id=c.id WHERE p_section='customers' AND (p_search='' OR c.name ILIKE '%'||p_search||'%' OR c.phone ILIKE '%'||p_search||'%')
 UNION ALL
 SELECT jsonb_build_object('id',s.id,'name',s.sale_number,'date',s.created_at,'customer',coalesce(c.name,'Walk-in'),'revenue',s.total_amount::text,'status',s.sale_status,'payment_status',s.payment_status,'method',(SELECT string_agg(DISTINCT payment_method,', ') FROM public.payments p WHERE p.sale_id=s.id)),s.sale_number,s.total_amount,0,s.created_at FROM public.sales s LEFT JOIN public.customers c ON c.id=s.customer_id WHERE p_section='transactions' AND s.created_at>=p_from AND s.created_at<p_to AND (p_search='' OR s.sale_number ILIKE '%'||p_search||'%' OR c.name ILIKE '%'||p_search||'%')
 ), ordered AS (SELECT *,row_number() OVER(ORDER BY CASE WHEN p_section IN ('movements','transactions') THEN happened END DESC,CASE WHEN p_section IN ('top','performance','customers') AND p_sort='revenue' THEN revenue END DESC,CASE WHEN p_section IN ('top','performance') AND p_sort='quantity' THEN quantity END DESC,label,row::text) rn FROM all_rows)
 SELECT jsonb_build_object('rows',coalesce((SELECT jsonb_agg(row ORDER BY rn) FROM ordered WHERE rn>p_page*20 AND rn<=(p_page+1)*20),'[]'::jsonb),'total',(SELECT count(*) FROM all_rows)) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.report_details(timestamptz,timestamptz,text,text,text,text,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.report_details(timestamptz,timestamptz,text,text,text,text,text,integer) TO authenticated;
CREATE INDEX IF NOT EXISTS payments_business_created_report_idx ON public.payments(business_id,created_at);
COMMENT ON FUNCTION public.report_overview(timestamptz,timestamptz,text) IS 'Read-only RLS-scoped reports. Revenue is completed PAID sales, pending value separate. Collections use PAID payment records dated in range against eligible sales. Numeric amounts are decimal strings.';
COMMENT ON FUNCTION public.report_details(timestamptz,timestamptz,text,text,text,text,text,integer) IS 'Read-only RLS-scoped report detail, fixed pages of 20. Historical product revenue is stored line subtotal after line discount, before sale-level discount/tax. Current inventory is not historical stock.';