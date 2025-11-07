require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const cloudinary = require('cloudinary').v2;
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ✅ Instagram Post Function (FIXED)
const postToInstagram = async (imageUrl, caption) => {
  try {
    console.log('📸 Creating Instagram media container...');
    
    // Step 1: Create Media Container
    const containerResponse = await axios.post(
      `https://graph.facebook.com/v18.0/${process.env.INSTAGRAM_ACCOUNT_ID}/media`,
      {
        image_url: imageUrl,
        caption: caption,
        access_token: process.env.ACCESS_TOKEN
      }
    );

    const creationId = containerResponse.data.id;
    console.log('✅ Container created:', creationId);

    // Wait for Facebook to process the image
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 2: Publish Media
    console.log('📤 Publishing to Instagram...');
    const publishResponse = await axios.post(
      `https://graph.facebook.com/v18.0/${process.env.INSTAGRAM_ACCOUNT_ID}/media_publish`,
      {
        creation_id: creationId,
        access_token: process.env.ACCESS_TOKEN
      }
    );

    console.log('✅ Posted successfully! ID:', publishResponse.data.id);
    return publishResponse.data;

  } catch (error) {
    console.error('❌ Instagram posting error:', error.response?.data || error.message);
    throw error;
  }
};

// 📤 Upload Image to Cloudinary
const uploadToCloudinary = async (imagePath) => {
  try {
    console.log('☁️ Uploading to Cloudinary...');
    
    const result = await cloudinary.uploader.upload(imagePath, {
      folder: 'instagram-posts',
      quality: 'auto',
      fetch_format: 'auto'
    });

    console.log('✅ Uploaded to Cloudinary:', result.secure_url);
    return result.secure_url;

  } catch (error) {
    console.error('❌ Cloudinary upload error:', error);
    throw error;
  }
};

// 🖼️ Process Image with Sharp
const processImage = async (inputPath, outputPath) => {
  try {
    console.log('🎨 Processing image...');
    
    await sharp(inputPath)
      .resize(1080, 1080, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 90 })
      .toFile(outputPath);

    console.log('✅ Image processed');
    return outputPath;

  } catch (error) {
    console.error('❌ Image processing error:', error);
    throw error;
  }
};

// 🔄 Main Posting Function
const schedulePost = async (imagePath, caption) => {
  try {
    // 1. Process Image
    const processedPath = path.join(__dirname, 'processed-image.jpg');
    await processImage(imagePath, processedPath);

    // 2. Upload to Cloudinary
    const cloudinaryUrl = await uploadToCloudinary(processedPath);

    // 3. Post to Instagram
    await postToInstagram(cloudinaryUrl, caption);

    // 4. Cleanup
    fs.unlinkSync(processedPath);
    
    console.log('✅ Post completed successfully!');

  } catch (error) {
    console.error('❌ Scheduling error:', error);
  }
};

// 📅 Cron Job - Har din 10 AM pe post
cron.schedule('0 10 * * *', async () => {
  console.log('⏰ Cron job triggered at 10 AM');
  
  const imagePath = path.join(__dirname, 'images', 'post.jpg');
  const caption = '🎯 Daily motivation! #instagram #automation';
  
  await schedulePost(imagePath, caption);
});

// 🌐 API Endpoints

// Test endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'running',
    message: 'Instagram Automation Server is active! 🚀' 
  });
});

// Manual post endpoint
app.post('/post', async (req, res) => {
  try {
    const { imagePath, caption } = req.body;
    
    if (!imagePath || !caption) {
      return res.status(400).json({ 
        error: 'imagePath and caption are required' 
      });
    }

    await schedulePost(imagePath, caption);
    
    res.json({ 
      success: true, 
      message: 'Posted successfully!' 
    });

  } catch (error) {
    res.status(500).json({ 
      error: error.message 
    });
  }
});

// Test Instagram connection
app.get('/test-connection', async (req, res) => {
  try {
    const response = await axios.get(
      `https://graph.facebook.com/v18.0/${process.env.INSTAGRAM_ACCOUNT_ID}`,
      {
        params: {
          fields: 'id,username,name',
          access_token: process.env.ACCESS_TOKEN
        }
      }
    );

    res.json({
      success: true,
      account: response.data
    });

  } catch (error) {
    res.status(500).json({
      error: error.response?.data || error.message
    });
  }
});

// Server start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🔗 http://localhost:${PORT}`);
  console.log('⏰ Cron job scheduled for 10 AM daily');
});
