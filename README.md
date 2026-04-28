# Complete + Feedback Bot

This bot is separated from the calculator/pricer bot.

It includes:
- `/complete-order` slash command
- `!f @worker` or `!f @worker1 @worker2` feedback request embed
- Submit Review modal
- Sythe Vouch link button
- `!d` reply-delete for completed order embeds

## Setup
1) Copy `.env.example` to `.env`
2) Fill:
   - DISCORD_TOKEN
   - CLIENT_ID
   - GUILD_ID
   - COMPLETED_ORDERS_CHANNEL_ID
   - FEEDBACK_CHANNEL_ID
   - SERVICES_CHANNEL_ID
   - CREATE_ORDER_CHANNEL_ID
   - image URLs and vouch URL
3) Run:
```bash
npm install
npm run deploy
npm start
```

## Commands
### Complete order
```text
/complete-order
```
Upload an image and write the completed order description. The embed goes to `COMPLETED_ORDERS_CHANNEL_ID`.

### Feedback request
```text
!f @worker
!f @worker1 @worker2 @worker3
```
Sends the customer feedback embed with buttons.

### Delete complete order
Reply to a `/complete-order` embed in the completed orders channel and type:
```text
!d
```
The original creator or allowed delete roles can delete it.

## Notes
- `!d` only works inside `COMPLETED_ORDERS_CHANNEL_ID` and only when replying to a Complete Order embed.
- Customer name in feedback is hidden by default unless they write `yes` in the modal.
