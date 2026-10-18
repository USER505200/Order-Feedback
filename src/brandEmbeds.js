// Grindora brand on every embed this bot sends or edits:
// - the brand banner under the message's embeds when none of them has an image of its own;
// - dead image links (Gyazo, expired Discord attachment links) replaced: big images with the banner,
//   icons and thumbnails with the logo.
// It works on the final message body (discord.js MessagePayload), so every send, reply, edit, follow-up
// and webhook goes through it. BRAND_BANNER_ENABLED=false turns the banner off (dead links are still fixed).
const { MessagePayload } = require('discord.js');

const BANNER = process.env.BRAND_BANNER_URL || 'https://gdrosrs.com/assets/brand/grindora-banner.gif';
const LOGO = process.env.BRAND_LOGO_URL || 'https://gdrosrs.com/assets/brand/grindora-logo.gif';

function isDead(url) {
  const value = String(url || '');
  if (/^https?:\/\/(i\.)?gyazo\.com\//i.test(value)) return true;
  // Discord attachment links carry their expiry (ex=, hex seconds); once past it they stop loading.
  const m = value.match(/^https?:\/\/(?:cdn|media)\.discordapp\.(?:com|net)\/attachments\/[^?]+\?(?:.*&)?ex=([0-9a-f]+)/i);
  return Boolean(m && parseInt(m[1], 16) * 1000 < Date.now() + 60 * 60 * 1000);
}

function brandEmbeds(embeds) {
  if (!Array.isArray(embeds) || !embeds.length) return embeds;
  for (const embed of embeds) {
    if (!embed || typeof embed !== 'object') continue;
    if (embed.image?.url && isDead(embed.image.url)) embed.image = { url: BANNER };
    if (embed.thumbnail?.url && isDead(embed.thumbnail.url)) embed.thumbnail = { url: LOGO };
    if (embed.author?.icon_url && isDead(embed.author.icon_url)) embed.author.icon_url = LOGO;
    if (embed.footer?.icon_url && isDead(embed.footer.icon_url)) embed.footer.icon_url = LOGO;
  }
  if (process.env.BRAND_BANNER_ENABLED !== 'false' && !embeds.some((embed) => embed?.image?.url)) {
    const last = embeds[embeds.length - 1];
    if (last && typeof last === 'object') last.image = { url: BANNER };
  }
  return embeds;
}

if (!MessagePayload.prototype.__grindoraBrand) {
  const resolveBody = MessagePayload.prototype.resolveBody;
  MessagePayload.prototype.resolveBody = function brandedResolveBody(...args) {
    const result = resolveBody.apply(this, args);
    try {
      brandEmbeds(this.body?.embeds);
      if (this.body?.data?.embeds) brandEmbeds(this.body.data.embeds);
    } catch (error) {
      console.warn('[brand] could not brand embeds:', error.message);
    }
    return result;
  };
  MessagePayload.prototype.__grindoraBrand = true;
}

module.exports = { brandEmbeds, isDead, BANNER, LOGO };
