import discord
from discord.ext import commands
import config
import asyncio

class ImageHandler(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message):
        if message.author.bot:
            return

        if message.channel.id != config.IMAGE_CHANNEL_ID:
            return

        if not message.attachments:
            return

        image_urls = []
        for attachment in message.attachments:
            if attachment.content_type and attachment.content_type.startswith('image/'):
                image_urls.append(attachment.url)

        if image_urls:
            try:
                image_link = image_urls[0]
                await message.delete()
                
                embed = discord.Embed(
                    title="🖼️ Your Image Link",
                    description=f"{image_link}",
                    color=discord.Color.blue()
                )
                embed.set_footer(text="This message will disappear in 1 minute")
                
                copy_button = discord.ui.Button(
                    label="📋 Copy Link",
                    style=discord.ButtonStyle.primary,
                    custom_id="copy_link"
                )
                
                view = discord.ui.View()
                view.add_item(copy_button)
                
                dm_message = await message.author.send(embed=embed, view=view)
                
                await asyncio.sleep(60)
                await dm_message.delete()
                
                print(f"✅ Sent image link to {message.author.name}")
                
            except discord.Forbidden:
                print(f"❌ Cannot send DM to {message.author.name}")
            except Exception as e:
                print(f"❌ Error in image handler: {e}")

    @commands.Cog.listener()
    async def on_interaction(self, interaction: discord.Interaction):
        if interaction.type == discord.InteractionType.component:
            if interaction.data.get("custom_id") == "copy_link":
                embed = interaction.message.embeds[0]
                image_link = embed.description
                
                await interaction.response.send_message(
                    f"✅ Link copied to clipboard!\n```\n{image_link}\n```",
                    ephemeral=True
                )

async def setup(bot):
    await bot.add_cog(ImageHandler(bot))
    print("✅ ImageHandler loaded")