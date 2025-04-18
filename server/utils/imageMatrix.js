const fs = require('fs').promises;
const path = require('path');

const defaultImagePath = path.join(__dirname, '../assets/matrix-images');

/**
 * Get a list of random image paths for the pass matrix
 * @param {number} count Number of images needed
 * @returns {Promise<Array<string>>} Array of image paths
 */
async function getRandomMatrixImages(count = 25) {
  try {
    // Read all images from the matrix-images directory
    const files = await fs.readdir(defaultImagePath);
    const imageFiles = files.filter(file => 
      /\.(jpg|jpeg|png|gif)$/i.test(file)
    );

    if (imageFiles.length < count) {
      throw new Error(`Not enough images in directory. Need ${count}, found ${imageFiles.length}`);
    }

    // Shuffle and select required number of images
    const shuffled = [...imageFiles].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count).map(file => `/matrix-images/${file}`);
  } catch (error) {
    console.error('Error getting matrix images:', error);
    throw error;
  }
}

module.exports = {
  getRandomMatrixImages,
  defaultImagePath
};
