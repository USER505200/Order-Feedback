# Complete + Feedback Bot

This bot is separated from the calculator/pricer bot.

It includes:
- `/complete-order` slash command
- `!f @worker` feedback request embed with support for multiple workers
- Submit Review modal
- `!d` reply-delete for completed order embeds
- Gmail-based Sythe vouch sync for new emails
- `!sythemanual` command for importing old Sythe vouches manually

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
   - `PRICE_LIST_CHANNEL_ID`
   - image URLs if needed such as `ORDER_COMPLETE_TOP_IMAGE_URL` and `FEEDBACK_BANNER_URL`
3) Run:
```bash
npm install
npm start
```
`npm start` auto-registers slash commands on boot.

## Railway notes
- Railway can deploy this project using the included `Dockerfile`.
- The Sythe integration uses Gmail polling and does not need a browser service.

## Commands
### Complete order
```text
/complete-order
```
Upload up to 10 images and write the completed order description. The bot re-uploads the files in the final message so the images stay available in Discord.
All completion images are sent as a grouped embed set, and the final message also includes `Price List` and `Create Order` link buttons.

### Feedback request
```text
!f @worker
!f @worker1 @worker2 @worker3 ...
```
Sends the customer feedback embed with the submit review button.

### Delete complete order
Reply to a `/complete-order` embed in the completed orders channel and type:
```text
!d
```
The original creator or allowed delete roles can delete it.

### Manual Sythe import
```text
!sythemanual username | vouch text | thread url (optional)
```
You can attach one image to use as the vouch author image during old/manual imports.

### Automatic Sythe Gmail sync
- Set `SYTHE_EMAIL_SYNC_ENABLED=true`
- Fill Gmail OAuth values and `SYTHE_VOUCHES_THREAD_URL`
- Optional: set `SYTHE_VOUCHES_THREAD_TITLE` if you want manual imports to use the exact same thread title
- The bot checks unread Sythe emails and posts new vouches to `SYTHE_VOUCHES_CHANNEL_ID`
- To generate `GMAIL_REFRESH_TOKEN`, run:
```bash
npm run gmail:token
```

## Notes
- `!d` only works inside `COMPLETED_ORDERS_CHANNEL_ID` and only when replying to a Complete Order embed.
- Customer name in feedback is hidden by default unless they write `yes` in the modal.
- Sythe email sync only processes unread Gmail messages from the watched vouch thread.
