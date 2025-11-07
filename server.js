const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const dotenv = require('dotenv');
const sharp = require('sharp');
const FormData = require('form-data');

dotenv.config();

const app = express();
app.use(express.json());

// Environment variables
const INSTAGRAM_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const INSTAGRAM_BUSINESS_ID = process.env.INSTAGRAM_BUSINESS_ID;
const FACEBOOK_TOKEN = process.env.FACEBOOK_PAGE_TOKEN;
const FACEBOOK_PAGE_ID = process.env.FACEBOOK_PAGE_ID;
const PORT = process.env.PORT || 5000;

console.log('✅ Server starting...');

// ===================== IMAGE GENERATOR =====================
class ImageGenerator {
  async generateImage(text, bgColor, textColor, style = 'simple') {
    try {
      console.log('📝 Generating image...');
      
      const width = 1080;
      const height = 1350;
      
      const bgRgb = this.hexToRgb(bgColor);
      const textRgb = this.hexToRgb(textColor);
      
      const lines = text.split('\n');
      let yPosition = 400;
      let svgText = '';
      
      for (let i = 0; i < lines.length; i++) {
        svgText += `<text x="540" y="${yPosition + (i * 150)}" 
                    font-size="80" 
                    font-weight="bold" 
                    text-anchor="middle" 
                    fill="rgb(${textRgb.r},${textRgb.g},${textRgb.b})"
                    font-family="Arial, sans-serif">
                    ${lines[i]}
                  </text>`;
      }
      
      const svg = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <rect width="${width}" height="${height}" fill="rgb(${bgRgb.r},${bgRgb.g},${bgRgb.b})"/>
          ${svgText}
        </svg>
      `;
      
      const buffer = await sharp(Buffer.from(svg))
        .png()
        .toBuffer();
      
      console.log('✅ Image generated successfully');
      return buffer;

    } catch (error) {
      console.error('❌ Image generation error:', error.message);
      return null;
    }
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      return {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      };
    }
    return { r: 15, g: 23, b: 42 };
  }
}

// ===================== SOCIAL MEDIA POSTER =====================
const axios = require('axios');
const FormData = require('form-data');
const { Readable } = require('stream');

class SocialMediaPoster {
  async postToFacebook(imageBuffer, caption) {
    try {
      console.log('📘 Posting to Facebook...');
      const formData = new FormData();
      
      // Image ko stream mein convert karo
      const stream = Readable.from(imageBuffer);
      formData.append('source', stream, 'image.png');
      formData.append('caption', caption);
      formData.append('access_token', process.env.FACEBOOK_TOKEN);
      
      const response = await axios.post(
        `https://graph.facebook.com/v18.0/${process.env.FACEBOOK_PAGE_ID}/photos`,
        formData,
        {
          headers: formData.getHeaders(),
          timeout: 30000
        }
      );
      
      if (response.status === 200 && response.data.id) {
        console.log('✅ Facebook post successful:', response.data.id);
        return response.data.id;
      }
    } catch (error) {
      console.error('❌ Facebook error:', error.response?.data || error.message);
      return null;
    }
  }

  async postToInstagram(imageBuffer, caption) {
    try {
      console.log('📱 Posting to Instagram...');
      
      // Step 1: Create media container
      const containerResponse = await axios.post(
        `https://graph.instagram.com/v18.0/${process.env.INSTAGRAM_BUSINESS_ID}/media`,
        {
          image_url: imageBuffer, // URL string expected, not base64
          caption: caption,
          access_token: process.env.INSTAGRAM_TOKEN
        },
        { timeout: 30000 }
      );
      
      if (containerResponse.status !== 200) {
        console.error('Container error:', containerResponse.data);
        return null;
      }
      
      const containerId = containerResponse.data.id;
      console.log('✅ Container created:', containerId);
      
      // Step 2: Publish media
      const publishResponse = await axios.post(
        `https://graph.instagram.com/v18.0/${process.env.INSTAGRAM_BUSINESS_ID}/media_publish`,
        {
          creation_id: containerId,
          access_token: process.env.INSTAGRAM_TOKEN
        },
        { timeout: 30000 }
      );
      
      if (publishResponse.status === 200) {
        console.log('✅ Instagram post successful:', publishResponse.data.id);
        return publishResponse.data.id;
      }
    } catch (error) {
      console.error('❌ Instagram error:', error.response?.data || error.message);
      return null;
    }
  }
}

module.exports = SocialMediaPoster;

// ===================== CONTENT TEMPLATES =====================
const CONTENT_TEMPLATES = [
  {
    text: '🤖 NexaFlow\nAI Automation\n24/7',
    caption: 'Automate your business with NexaFlow AI. No manual work. 100% hands-free automation. #AI #Automation #NexaFlow',
    bgColor: '#0F172A',
    textColor: '#00D9FF'
  },
  {
    text: '⚡ Smart Work\nZero Effort\nMaximum Results',
    caption: 'Let NexaFlow handle your repetitive tasks. Focus on growth! #SmartAutomation #NexaFlow',
    bgColor: '#1A1A2E',
    textColor: '#00FFFF'
  },
  {
    text: '🚀 NexaFlow\nYour AI Agent\n24/7 Active',
    caption: 'Never miss a lead. Never do manual work. NexaFlow works while you sleep. #AI #Automation',
    bgColor: '#0D1B2A',
    textColor: '#FF00FF'
  },
  {
    text: '💡 Transform\nYour Business\nWith AI',
    caption: 'Fully hands-free automation. Zero missed leads. NexaFlow AI Agent. #FutureOfWork #Automation',
    bgColor: '#16213E',
    textColor: '#00D9FF'
  }
];

// ===================== MAIN AUTOMATION =====================
async function automatePosting() {
  try {
    console.log('\n🚀 Starting automation...');
    
    const imgGen = new ImageGenerator();
    const poster = new SocialMediaPoster();

    const content = CONTENT_TEMPLATES[Math.floor(Math.random() * CONTENT_TEMPLATES.length)];
    console.log('📋 Selected content:', content.text);

    // Generate image
    const imageBuffer = await imgGen.generateImage(
      content.text,
      content.bgColor,
      content.textColor
    );

    if (!imageBuffer) {
      console.error('❌ Image generation failed');
      return { status: 'error', message: 'Image generation failed' };
    }

    // Post to Facebook
    const fbPostId = await poster.postToFacebook(imageBuffer, content.caption);

    // Post to Instagram
    const instaPostId = await poster.postToInstagram(imageBuffer, content.caption);

    const result = {
      timestamp: new Date().toISOString(),
      facebookPostId: fbPostId,
      instagramPostId: instaPostId,
      caption: content.caption,
      status: (fbPostId || instaPostId) ? 'success' : 'error'
    };

    console.log('\n📊 Report:', result);
    return result;

  } catch (error) {
    console.error('❌ Automation error:', error.message);
    return { status: 'error', message: error.message };
  }
}

// ===================== ROUTES =====================

app.get('/api/health', (req, res) => {
  res.json({ status: '✅ Alive', timestamp: new Date().toISOString() });
});

app.get('/screenshot', (req, res) => {
  res.json({ status: '✅ Ready' });
});

app.get('/api/status', (req, res) => {
  res.json({
    server: 'running',
    instagram: !!INSTAGRAM_TOKEN,
    facebook: !!FACEBOOK_TOKEN,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/post-now', async (req, res) => {
  const result = await automatePosting();
  res.json(result);
});

// ===================== SCHEDULER =====================
cron.schedule('0 9 * * *', () => {
  console.log('⏰ Daily automation triggered');
  automatePosting();
});

console.log('✅ Scheduler active');

// ===================== START =====================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎬 Server running on port ${PORT}`);
});
