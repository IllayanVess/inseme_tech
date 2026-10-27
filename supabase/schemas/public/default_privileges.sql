-- New tables and routines start locked down. Grant access explicitly per object.
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
  REVOKE ALL ON SEQUENCES FROM PUBLIC, "anon", "authenticated", "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
  REVOKE ALL ON FUNCTIONS FROM PUBLIC, "anon", "authenticated", "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
  REVOKE ALL ON TABLES FROM PUBLIC, "anon", "authenticated", "service_role";

-- Server-side service credentials retain the access they need; public tables
-- still require their own explicit grants and RLS policies.
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
  GRANT EXECUTE ON FUNCTIONS TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
  GRANT ALL ON TABLES TO "service_role";
