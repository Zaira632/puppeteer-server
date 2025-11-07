const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const dotenv = require('dotenv');
const sharp = require('sharp');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

dotenv.config();

const app = express();
app.use(express.json());

// ✅ FIXED: Match Railway variable names exactly
const INSTAGRAM_TOKEN = process.env.INSTAGRAM_TOKEN;
const INSTAGRAM_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID;
const FACEBOOK_TOKEN = process.env.FACEBOOK_TOKEN;
const FACEBOOK_PAGE_ID = process.env.FACEBOOK_PAGE_ID;
const PORT = process.env.PORT || 5000;

// ✅ Environment validation
console.log('🔍 Environment Check:');
console.log('Instagram Token:', INSTAGRAM_TOKEN ? '✅ Loaded' : '❌ Missing');
console.log('Instagram Account ID:', INSTAGRAM_ACCOUNT_ID ? '✅ Loaded' : '❌ Missing');
console.log('Facebook Token:', FACEBOOK_TOKEN ? '✅ Loaded' : '❌ Missing');
console.log('Facebook Page ID:', FACEBOOK_PAGE_ID ? '✅ Loaded' : '❌ Missing');

if (!INSTAGRAM_TOKEN || !INSTAGRAM_ACCOUNT_ID || !FACEBOOK_TOKEN || !FACEBOOK_PAGE_ID) {
  console.error('❌ Missing required environment variables!');
  console.error('Required: INSTAGRAM_TOKEN, INSTAGRAM_ACCOUNT_ID, FACEBOOK_TOKEN, FACEBOOK_PAGE_ID');
}

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
class SocialMediaPoster {
  async postToFacebook(imageBuffer, caption) {
    try {
      console.log('📘 Posting to Facebook...');
      
      if (!FACEBOOK_TOKEN || !FACEBOOK_PAGE_ID) {
        console.error('❌ Facebook credentials missing');
        return null;
      }
      
      const formData = new FormData();
      const stream = Readable.from(imageBuffer);
      formData.append('source', stream, 'image.png');
      formData.append('caption', caption);
      formData.append('access_token', FACEBOOK_TOKEN);
      
      const response = await axios.post(
        `https://graph.facebook.com/v18.0/${FACEBOOK_PAGE_ID}/photos`,
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

  // ✅ FIXED: Instagram API requires public URL, not file upload
  async postToInstagram(imageBuffer, caption) {
    try {
      console.log('📱 Instagram posting requires public image URL');
      console.log('⚠️ Instagram Graph API does not support direct file upload');
      console.log('💡 You need to:');
      console.log('   1. Upload image to Cloudinary/S3/ImgBB first');
      console.log('   2. Get public URL');
      console.log('   3. Use that URL in Instagram API');
      
      // ⚠️ This is the CORRECT way but needs image hosting service
      /*
      // Step 1: Upload to Cloudinary (example)
      const publicUrl = await this.uploadToCloudinary(imageBuffer);
      
      if (!publicUrl) {
        console.error('❌ Failed to get public URL');
        return null;
      }
      
      // Step 2: Create media container with public URL
      const containerResponse = await axios.post(
        `https://graph.facebook.com/v18.0/${INSTAGRAM_ACCOUNT_ID}/media`,
        {
          image_url: publicUrl,  // ✅ Must be publicly accessible
          caption: caption,
          access_token: INSTAGRAM_TOKEN
        }
      );
      
      const containerId = containerResponse.data.id;
      console.log('✅ Container created:', containerId);
      
      // Step 3: Wait for processing (10 seconds)
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Step 4: Publish
      const publishResponse = await axios.post(
        `https://graph.facebook.com/v18.0/${INSTAGRAM_ACCOUNT_ID}/media_publish`,
        {
          creation_id: containerId,
          access_token: INSTAGRAM_TOKEN
        }
      );
      
      console.log('✅ Instagram post successful:', publishResponse.data.id);
      return publishResponse.data.id;
      */
      
      return null;
      
    } catch (error) {
      console.error('❌ Instagram error:', error.response?.data || error.message);
      return null;
    }
  }
  
  // ✅ TODO: Add Cloudinary upload function
  async uploadToCloudinary(imageBuffer) {
    // Install: npm install cloudinary
    // Setup Cloudinary credentials in Railway
    console.log('⚠️ Cloudinary integration needed');
    return null;
  }
}

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

    console.log('✅ Image generated successfully');

    // Post to Facebook
    const fbPostId = await poster.postToFacebook(imageBuffer, content.caption);

    // Post to Instagram (currently disabled - needs Cloudinary)
    const instaPostId = null; // await poster.postToInstagram(imageBuffer, content.caption);

    const result = {
      timestamp: new Date().toISOString(),
      facebookPostId: fbPostId,
      instagramPostId: instaPostId,
      caption: content.caption,
      status: fbPostId ? 'success' : 'error',
      note: 'Instagram requires Cloudinary setup'
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
    instagramAccountId: !!INSTAGRAM_ACCOUNT_ID,
    facebook: !!FACEBOOK_TOKEN,
    facebookPageId: !!FACEBOOK_PAGE_ID,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/post-now', async (req, res) => {
  const result = await automatePosting();
  res.json(result);
});

// ===================== SCHEDULER =====================
cron.schedule('0 9 * * *', () => {
  console.log('⏰ Daily automation triggered at 9 AM');
  automatePosting();
});

console.log('✅ Scheduler active - Posts will be created daily at 9 AM');

// ===================== START =====================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎬 Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📍 Status check: http://localhost:${PORT}/api/status`);
  console.log(`📍 Manual post: POST http://localhost:${PORT}/api/post-now`);
});
