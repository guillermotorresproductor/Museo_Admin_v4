-- Scope: employee_leave_requests only. Preserve service_role and administrative owner grants.
-- Enforce least privilege for browser roles. RLS additionally constrains SELECT and INSERT.
revoke all privileges on table public.employee_leave_requests from public, anon, authenticated;
grant select, insert on table public.employee_leave_requests to authenticated;
-- Decisions remain through public.review_employee_leave_request(uuid,text).
