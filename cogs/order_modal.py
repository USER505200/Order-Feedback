import discord
from discord import app_commands
from discord.ext import commands
import config

# Image URLs
TOP_IMAGE_URL = "https://cdn.discordapp.com/attachments/1489497861350494339/1489723944582910002/word_1.gif?ex=69d1750a&is=69d0238a&hm=e9861e30bd5918e66c2d324e9bf21104bd21d8c18de12fb6cfa00681ce6f51e1&"
BOTTOM_IMAGE_URL = "https://cdn.discordapp.com/attachments/1489497861350494339/1489730355316392088/Untitled-1.gif?ex=69d17b02&is=69d02982&hm=91bba9f3cb622da72a3555f8a9ed89383f533898b0172e271605523595e1ce54&"

class OrderModal(discord.ui.Modal, title='Complete Order'):
    def __init__(self):
        super().__init__()

    comment = discord.ui.TextInput(
        label='Comment',
        placeholder='Write your comment here...',
        style=discord.TextStyle.paragraph,
        required=True,
        max_length=2000
    )

    image_link = discord.ui.TextInput(
        label='Image Link',
        placeholder='Paste the image link here...',
        style=discord.TextStyle.short,
        required=True
    )

    async def on_submit(self, interaction: discord.Interaction):
        channel = interaction.guild.get_channel(config.ORDER_CHANNEL_ID)
        
        if not channel:
            await interaction.response.send_message(f"❌ Channel not found!", ephemeral=True)
            return

        comment_in_frame = f"```css\n{self.comment.value}\n```"
        
        fixed_text = """🛒 Explore all services: <#1487243724865011822>
🎫 Start a new order: <#1487244035516006551>"""
        
        emoji = "<a:12964893757058582011:1488901115750650017>"
        
        embed = discord.Embed(
            title=f"{emoji}   Completed Order  {emoji}",
            description=comment_in_frame,
            color=discord.Color.orange()
        )
        
        # Top right image (thumbnail)
        embed.set_thumbnail(url=TOP_IMAGE_URL)
        
        # Add information field
        embed.add_field(name="📌 Information", value=fixed_text, inline=False)
        
        # Add security notice
        embed.add_field(
            name="⚠️ Security Notice",
            value="• Change your account password immediately\n• Log out of all active sessions\n• Keep this ticket for support",
            inline=False
        )
        
        # Bottom image (main image from user input)
        embed.set_image(url=self.image_link.value)
        
        # Footer with completion info
        embed.set_footer(
            text=f"Completed by: {interaction.user.display_name} • Order completed successfully",
            icon_url=interaction.user.display_avatar.url
        )
        
        await channel.send(embed=embed)
        
        # Send confirmation to user
        confirm_embed = discord.Embed(
            title="✅ Order Completed Successfully!",
            description=f"Your order has been completed and sent to <#{config.ORDER_CHANNEL_ID}>.\nThank you for choosing Grindora!",
            color=discord.Color.green()
        )
        confirm_embed.set_thumbnail(url=TOP_IMAGE_URL)
        
        await interaction.response.send_message(embed=confirm_embed, ephemeral=True)

class OrderCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @app_commands.command(name="complete_order", description="Complete an order with comment and image")
    async def complete_order(self, interaction: discord.Interaction):
        user_role_ids = [role.id for role in interaction.user.roles]
        has_permission = any(role_id in user_role_ids for role_id in config.ALLOWED_ROLE_IDS)
        
        if not has_permission:
            await interaction.response.send_message(
                "❌ You don't have permission to use this command!",
                ephemeral=True
            )
            return
        
        modal = OrderModal()
        await interaction.response.send_modal(modal)

async def setup(bot):
    await bot.add_cog(OrderCog(bot))
    print("✅ OrderCog loaded")