# Complete + Feedback Bot

This bot is separated from the calculator/pricer bot.

It includes:
- `/complete-order` slash command
- `!f @worker` feedback request embed with support for multiple workers
- Submit Review modal
- `!d` reply-delete for completed order embeds

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
   - image URLs if needed such as `ORDER_COMPLETE_TOP_IMAGE_URL` and `FEEDBACK_BANNER_URL`
3) Run:
```bash
npm install
npm start
```
`npm start` auto-registers slash commands on boot.

## Railway notes
- Railway can deploy this project using the included `Dockerfile`.
- The bot no longer includes any Sythe sync integration or external browser dependency.

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
Sends the customer feedback embed with the submit review button.

### Delete complete order
Reply to a `/complete-order` embed in the completed orders channel and type:
```text
!d
```
The original creator or allowed delete roles can delete it.

## Notes
- `!d` only works inside `COMPLETED_ORDERS_CHANNEL_ID` and only when replying to a Complete Order embed.
- Customer name in feedback is hidden by default unless they write `yes` in the modal.
