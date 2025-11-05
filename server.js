const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const dotenv = require('dotenv');
const Jimp = require('jimp');
const cloudinary = require('cloudinary').v2;

dotenv.config();

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

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
      
      const image = new Jimp({
        width: 1080,
        height: 1350,
        color: this.hexToInt(bgColor)
      });

      const font = await Jimp.loadFont(Jimp.FONT_SIZE_64);

      const lines = text.split('\n');
      const lineHeight = 100;
      const totalHeight = lines.length * lineHeight;
      let startY = (1350 - totalHeight) / 2;

      for (let line of lines) {
        const textWidth = Jimp.measureText(font, line);
        const x = (1080 - textWidth) / 2;
        image.print({
          font: font,
          x: x,
          y: startY,
          text: line,
          maxWidth: 1000,
          alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
          alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
        });
        startY += lineHeight;
      }

      const buffer = await image.toBuffer('image/png');
      console.log('✅ Image generated successfully');
      return buffer;

    } catch (error) {
      console.error('❌ Image generation error:', error.message);
      return null;
    }
  }

  hexToInt(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      const r = parseInt(result[1], 16);
      const g = parseInt(result[2], 16);
      const b = parseInt(result[3], 16);
      return (r << 24) | (g << 16) | (b << 8) | 0xFF;
    }
    return 0xFF6B6BFF;
  }
}

// ===================== INSTAGRAM/FACEBOOK POSTER =====================
class SocialMediaPoster {
  async uploadToCloudinary(imageBuffer) {
    try {
      console.log('📥 Uploading to Cloudinary...');
      
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { resource_type: 'auto' },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(imageBuffer);
      });

      if (result.secure_url) {
        console.log('✅ Uploaded to Cloudinary:', result.secure_url);
        return result.secure_url;
      }
      throw new Error('Cloudinary upload failed');

    } catch (error) {
      console.error('❌ Cloudinary error:', error.message);
      return null;
    }
  }

  async postToInstagram(imageUrl, caption) {
    try {
      console.log('📱 Posting to Instagram...');

      const containerResponse = await axios.post(
        `https://graph.instagram.com/v18.0/${INSTAGRAM_BUSINESS_ID}/media`,
        {
          image_url: imageUrl,
          caption: caption,
          access_token: INSTAGRAM_TOKEN
        },
        { timeout: 30000 }
      );

      if (containerResponse.status !== 200) {
        throw new Error(`Container error: ${containerResponse.data.error}`);
      }

      const containerId = containerResponse.data.id;
      console.log('✅ Container created:', containerId);

      const publishResponse = await axios.post(
        `https://graph.instagram.com/v18.0/${INSTAGRAM_BUSINESS_ID}/media_publish`,
        {
          creation_id: containerId,
          access_token: INSTAGRAM_TOKEN
        },
        { timeout: 30000 }
      );

      if (publishResponse.status === 200) {
        console.log('✅ Instagram post successful:', publishResponse.data.id);
        return publishResponse.data.id;
      }

    } catch (error) {
      console.error('❌ Instagram error:', error.message);
      return null;
    }
  }

  async postToFacebook(imageUrl, caption) {
    try {
      console.log('📘 Posting to Facebook...');

      const response = await axios.post(
        `https://graph.facebook.com/v18.0/${FACEBOOK_PAGE_ID}/photos`,
        {
          url: imageUrl,
          caption: caption,
          access_token: FACEBOOK_TOKEN
        },
        { timeout: 30000 }
      );

      if (response.status === 200) {
        console.log('✅ Facebook post successful:', response.data.id);
        return response.data.id;
      }

    } catch (error) {
      console.error('❌ Facebook error:', error.message);
      return null;
    }
  }
}

// ===================== CONTENT TEMPLATES =====================
const CONTENT_TEMPLATES = [
  {
    text: '🎉 Amazing Deal\n50% OFF',
    caption: 'Limited time offer! Don\'t miss out! #deals #shopping #offer',
    bgColor: '#FF6B6B',
    textColor: '#FFFFFF',
    style: 'border'
  },
  {
    text: '🔥 New Collection\nAvailable Now',
    caption: 'Check out our latest products! #new #collection #trend',
    bgColor: '#4ECDC4',
    textColor: '#FFFFFF',
    style: 'simple'
  },
  {
    text: '🎁 Weekend Special\nBig Discount',
    caption: 'Perfect gifts for everyone! #weekend #special #offer',
    bgColor: '#95E1D3',
    textColor: '#FFFFFF',
    style: 'simple'
  }
];

// ===================== MAIN AUTOMATION FUNCTION =====================
async function automatePosting() {
  try {
    console.log('\n🚀 Starting automation...');
    
    const imgGen = new ImageGenerator();
    const poster = new SocialMediaPoster();

    const content = CONTENT_TEMPLATES[Math.floor(Math.random() * CONTENT_TEMPLATES.length)];
    console.log('📋 Selected content:', content.text);

    const imageBuffer = await imgGen.generateImage(
      content.text,
      content.bgColor,
      content.textColor,
      content.style
    );

    if (!imageBuffer) {
      console.error('❌ Image generation failed');
      return;
    }

    const imageUrl = await poster.uploadToCloudinary(imageBuffer);
    if (!imageUrl) {
      console.error('❌ Upload failed');
      return;
    }

    const instaPostId = await poster.postToInstagram(imageUrl, content.caption);
    const fbPostId = await poster.postToFacebook(imageUrl, content.caption);

    const result = {
      timestamp: new Date().toISOString(),
      imageUrl: imageUrl,
      instagramPostId: instaPostId,
      facebookPostId: fbPostId,
      caption: content.caption,
      status: (instaPostId && fbPostId) ? 'success' : 'partial'
    };

    console.log('\n📊 Final Report:', result);
    return result;

  } catch (error) {
    console.error('❌ Automation error:', error.message);
  }
}

// ===================== ROUTES =====================

app.get('/api/health', (req, res) => {
  res.json({
    status: '✅ Server is alive!',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/screenshot', (req, res) => {
  res.json({
    status: '✅ Screenshot endpoint working!',
    message: 'Server is ready'
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    server: 'running',
    instagram_configured: !!INSTAGRAM_TOKEN,
    facebook_configured: !!FACEBOOK_TOKEN,
    cloudinary_configured: !!process.env.CLOUDINARY_CLOUD_NAME,
    scheduler: 'active',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/post-now', async (req, res) => {
  try {
    const result = await automatePosting();
    res.json(result || { status: 'error' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/generate-image', async (req, res) => {
  try {
    const { text, bgColor, textColor, style } = req.body;
    const imgGen = new ImageGenerator();
    
    const imageBuffer = await imgGen.generateImage(
      text || '🎉 Hello World',
      bgColor || '#FF6B6B',
      textColor || '#FFFFFF',
      style || 'simple'
    );

    if (imageBuffer) {
      res.set('Content-Type', 'image/png');
      res.send(imageBuffer);
    } else {
      res.status(500).json({ error: 'Image generation failed' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===================== SCHEDULER =====================
cron.schedule('0 9 * * *', () => {
  console.log('\n⏰ Scheduled automation triggered');
  automatePosting();
});

console.log('✅ Scheduler started');

// ===================== SERVER START =====================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎬 Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📍 Status: http://localhost:${PORT}/api/status`);
  console.log(`📍 Post now: POST http://localhost:${PORT}/api/post-now`);
});
