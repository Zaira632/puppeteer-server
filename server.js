const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const dotenv = require('dotenv');
const sharp = require('sharp');
const FormData = require('form-data');
const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');

dotenv.config();

const app = express();
app.use(express.json());

// ✅ Environment Variables
const INSTAGRAM_TOKEN = process.env.INSTAGRAM_TOKEN;
const INSTAGRAM_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID;
const FACEBOOK_TOKEN = process.env.FACEBOOK_TOKEN;
const FACEBOOK_PAGE_ID = process.env.FACEBOOK_PAGE_ID;
const PORT = process.env.PORT || 5000;

// ✅ Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ✅ Environment validation
console.log('🔍 Environment Check:');
console.log('Instagram Token:', INSTAGRAM_TOKEN ? '✅ Loaded' : '❌ Missing');
console.log('Instagram Account ID:', INSTAGRAM_ACCOUNT_ID ? '✅ Loaded' : '❌ Missing');
console.log('Facebook Token:', FACEBOOK_TOKEN ? '✅ Loaded' : '❌ Missing');
console.log('Facebook Page ID:', FACEBOOK_PAGE_ID ? '✅ Loaded' : '❌ Missing');
console.log('Cloudinary:', process.env.CLOUDINARY_CLOUD_NAME ? '✅ Configured' : '❌ Missing');

if (!INSTAGRAM_TOKEN || !INSTAGRAM_ACCOUNT_ID || !FACEBOOK_TOKEN || !FACEBOOK_PAGE_ID) {
  console.error('❌ Missing required environment variables!');
}

if (!process.env.CLOUDINARY_CLOUD_NAME) {
  console.warn('⚠️ Cloudinary not configured - Instagram posting will be disabled');
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

  // ✅ FIXED: Instagram with Cloudinary
  async postToInstagram(imageBuffer, caption) {
    try {
      console.log('📱 Posting to Instagram...');
      
      if (!INSTAGRAM_TOKEN || !INSTAGRAM_ACCOUNT_ID) {
        console.error('❌ Instagram credentials missing');
        return null;
      }
      
      if (!process.env.CLOUDINARY_CLOUD_NAME) {
        console.error('❌ Cloudinary not configured');
        return null;
      }
      
      // Step 1: Upload to Cloudinary
      console.log('☁️ Uploading to Cloudinary...');
      const publicUrl = await this.uploadToCloudinary(imageBuffer);
      
      if (!publicUrl) {
        console.error('❌ Failed to get public URL');
        return null;
      }
      
      console.log('✅ Image uploaded:', publicUrl);
      
      // Step 2: Create media container
      console.log('📦 Creating Instagram media container...');
      const containerResponse = await axios.post(
        `https://graph.facebook.com/v18.0/${INSTAGRAM_ACCOUNT_ID}/media`,
        {
          image_url: publicUrl,
          caption: caption,
          access_token: INSTAGRAM_TOKEN
        }
      );
      
      const containerId = containerResponse.data.id;
      console.log('✅ Container created:', containerId);
      
      // Step 3: Wait for processing
      console.log('⏳ Waiting for Instagram to process (15 seconds)...');
      await new Promise(resolve => setTimeout(resolve, 15000));
      
      // Step 4: Publish
      console.log('📤 Publishing to Instagram...');
      const publishResponse = await axios.post(
        `https://graph.facebook.com/v18.0/${INSTAGRAM_ACCOUNT_ID}/media_publish`,
        {
          creation_id: containerId,
          access_token: INSTAGRAM_TOKEN
        }
      );
      
      console.log('✅ Instagram post successful:', publishResponse.data.id);
      return publishResponse.data.id;
      
    } catch (error) {
      console.error('❌ Instagram error:', error.response?.data || error.message);
      return null;
    }
  }
  
  // ✅ FIXED: Cloudinary Upload Function
  async uploadToCloudinary(imageBuffer) {
    try {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'nexaflow',
            resource_type: 'image',
            format: 'png'
          },
          (error, result) => {
            if (error) {
              console.error('❌ Cloudinary upload error:', error);
              reject(error);
            } else {
              console.log('✅ Cloudinary upload successful');
              resolve(result.secure_url);
            }
          }
        );
        
        const readableStream = Readable.from(imageBuffer);
        readableStream.pipe(uploadStream);
      });
    } catch (error) {
      console.error('❌ Cloudinary error:', error);
      return null;
    }
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

    // Post to Instagram (now enabled with Cloudinary)
    const instaPostId = await poster.postToInstagram(imageBuffer, content.caption);

    const result = {
      timestamp: new Date().toISOString(),
      facebookPostId: fbPostId,
      instagramPostId: instaPostId,
      caption: content.caption,
      status: (fbPostId || instaPostId) ? 'success' : 'error',
      platforms: {
        facebook: fbPostId ? 'posted' : 'failed',
        instagram: instaPostId ? 'posted' : 'failed'
      }
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
    cloudinary: !!process.env.CLOUDINARY_CLOUD_NAME,
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
