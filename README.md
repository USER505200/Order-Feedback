# Complete + Feedback Bot

This bot is separated from the calculator/pricer bot.

It includes:
- `/complete-order` slash command
- `!f @worker` feedback request embed with support for multiple workers
- Submit Review modal
- Sythe Vouch link button
- `!d` reply-delete for completed order embeds
- automatic Sythe vouch sync into a Discord channel
- `/sythe-sync-now` manual Sythe sync command

## Setup
1) Copy `.env.example` to `.env`
2) Fill:
   - `DISCORD_TOKEN`
   - `CLIENT_ID`
   - `GUILD_ID`
   - `COMPLETED_ORDERS_CHANNEL_ID`
   - `FEEDBACK_CHANNEL_ID`
   - `SERVICES_CHANNEL_ID`
   - `CREATE_ORDER_CHANNEL_ID`
   - image URLs and vouch URL
   - `SYTHE_VOUCHES_THREAD_URL`
   - `SYTHE_VOUCHES_CHANNEL_ID`
   - optional Sythe logo/banner URLs
3) Run:
```bash
npm install
npm start
```
`npm start` auto-registers slash commands on boot.

## Railway / Sythe notes
- Direct `fetch` requests to Sythe are blocked by Cloudflare, so this project uses Playwright in Docker for the Sythe sync.
- ZenRows works here through `SYTHE_BROWSER_WS_ENDPOINT` using Playwright `connectOverCDP`, so use the full `Scraping Browser URL` from ZenRows.
- If the remote browser still fails on a protected Sythe page, the bot now automatically falls back to the ZenRows Universal Scraper API using the same ZenRows API key from `SYTHE_BROWSER_WS_ENDPOINT`.
- Railway should deploy this project using the included `Dockerfile`.
- Use a dedicated Discord channel for `SYTHE_VOUCHES_CHANNEL_ID` so the bot can detect the last synced Sythe post reliably.

## Commands
### Complete order
```text
/complete-order
```
Upload up to 10 images and write the completed order description. The bot re-uploads the files in the final message so the images stay available in Discord.

### Feedback request
```text
!f @worker
!f @worker1 @worker2 @worker3 ...
```
Sends the customer feedback embed with buttons.

### Delete complete order
Reply to a `/complete-order` embed in the completed orders channel and type:
```text
!d
```
The original creator or allowed delete roles can delete it.

### Manual Sythe sync
```text
/sythe-sync-now
```
Runs a manual sync for the Sythe vouch thread.

## Notes
- `!d` only works inside `COMPLETED_ORDERS_CHANNEL_ID` and only when replying to a Complete Order embed.
- Customer name in feedback is hidden by default unless they write `yes` in the modal.
- `SYTHE_BACKFILL_LIMIT=0` means sync all historical vouches on the first run.
- `SYTHE_SYNC_ENABLED=true` is fine once `SYTHE_BROWSER_WS_ENDPOINT` and `SYTHE_VOUCHES_CHANNEL_ID` are filled in.
