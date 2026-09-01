# EduBridge Mobile

Separate React Native + Expo Router app for the existing EduBridge Supabase project.

## Roles

- Parent: home, child switching, attendance, homework, messages, profile
- Teacher: home, classes, attendance marking, messages, profile

The app uses the same Supabase authentication, tables, RLS policies, and user accounts as the web application. Attendance and messages written here are immediately available to the web dashboards.

Copy `.env.example` to `.env` and provide the same Supabase URL and anon key used by the web app. Run the app from this directory with the Expo scripts in `package.json`.
