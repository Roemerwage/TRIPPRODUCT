Short guide — deploy EAS Update group to production

1) Verify the update group exists:
   eas update:view <UPDATE_GROUP_ID>

2) Republish (you already ran this, it's OK if you republished):
   eas update:republish --group <UPDATE_GROUP_ID>
   (this creates a new update group; it does not automatically "deploy" it to a channel)

3) Deploy the update group to production (recommended: use the Expo dashboard UI):
   - Open https://expo.dev/accounts/<ACCOUNT>/projects/<PROJECT>/updates
   - Click the update group you want (e.g. e471e0ba...)
   - Click "Deploy" / "Deploy to production" (or similar) to create the deployment for that runtime

   Why use the UI? Your EAS CLI version may publish/republish update groups but the dashboard is the simplest way to create the Deployment that makes the update available to installed apps.

4) On device:
   - Fully quit the app (swipe-kill)
   - Re-open the app (cold start) — with updates.checkAutomatically: "ON_LOAD" the app checks for and downloads the deployed update at launch.

5) Verification:
   - Dashboard: the update group page should now show a "Deployments" entry for production.
   - CLI: re-run
       eas update:view <UPDATE_GROUP_ID>
     and confirm Deployments appear in the dashboard UI.

Notes:
- Ensure the runtimeVersion in app.json (1.0.0) exactly matches the runtimeVersion shown in the update group.
- Only release-store builds (not Expo Go) will receive updates tied to your embedded runtimeVersion.
