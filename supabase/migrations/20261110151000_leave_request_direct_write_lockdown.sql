-- No browser role may directly change a leave decision; review RPC is sole writer.
revoke update, delete on public.employee_leave_requests from authenticated, anon, public;
