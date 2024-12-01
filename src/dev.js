import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url'; // Import for converting URL to path
import { dirname } from 'path'; // Import for resolving directory names
import fs from 'fs';

dotenv.config();

// Middleware setup
const app = express();
app.use(express.json());  // For parsing JSON bodies

const allowedOrigins = process.env.NODE_ENV === 'production' 
    ? ['https://your-production-domain.com'] 
    : ['http://localhost:3000'];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true); // Allow the request
        } else {
            callback(new Error('Not allowed by CORS')); // Reject the request
        }
    },
    credentials: true,
}));

// Get the __dirname equivalent in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure that the 'uploads/animals' directory exists
const uploadDir = path.join(__dirname, 'uploads', 'animals');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });  // Create the directory if it doesn't exist
}

// Static file serving for animal images
app.use('/uploads/animals', express.static(uploadDir));

// Multer setup for image uploads (specifically for animals)
const animalImageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Ensure the 'uploads/animals' folder is used
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Use a unique filename with timestamp to avoid collisions
    cb(null, Date.now() + '-' + file.originalname);
  },
});

const uploadAnimalImage = multer({
  storage: animalImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
}).single('image');

// MongoDB Connection (Make sure to use DB URI)
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Category Model
const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
  },
  { timestamps: true }
);
const Category = mongoose.model('Category', categorySchema);

// Animal Model (Removed 'description' field as per the requirement)
const animalSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    image: { type: String },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  },
  { timestamps: true }
);
const Animal = mongoose.model('Animal', animalSchema);

// Controllers

// Get all categories
const getCategories = async (req, res) => {
  console.log("Fetching all categories...");
  try {
    const categories = await Category.find();
    if (!categories || categories.length === 0) {
      console.log("No categories found.");
      return res.status(404).json({ message: 'No categories found' });
    }
    console.log("Categories fetched successfully:", categories);
    res.status(200).json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ message: 'Error fetching categories', error });
  }
};

// Get a category by ID and its animals
const getCategoryById = async (req, res) => {
  const { categoryId } = req.params;

  console.log(`Fetching category with ID: ${categoryId}`);

  // Validate the categoryId to ensure it's a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    console.log(`Invalid category ID format: ${categoryId}`);
    return res.status(400).json({ message: 'Invalid category ID format' });
  }

  try {
    const category = await Category.findById(categoryId);
    if (!category) {
      console.log(`Category with ID ${categoryId} not found`);
      return res.status(404).json({ message: 'Category not found' });
    }

    const animals = await Animal.find({ category: categoryId }).populate('category');
    console.log(`Category and associated animals fetched successfully: ${category.name}, ${animals.length} animals found`);
    
    res.status(200).json({ category, animals });
  } catch (error) {
    console.error(`Error fetching category with ID ${categoryId}:`, error);
    res.status(500).json({ message: 'Error fetching category and animals', error });
  }
};

// Add a category
const addCategory = async (req, res) => {
  const { name } = req.body;
  console.log(`Adding new category: ${name}`);

  try {
    // Validate if category name is provided
    if (!name) {
      console.log("Category name is required");
      return res.status(400).json({ message: 'Category name is required' });
    }

    const newCategory = new Category({ name });
    await newCategory.save();
    console.log("Category added successfully:", newCategory);
    res.status(201).json(newCategory);
  } catch (error) {
    console.error("Error adding category:", error);
    res.status(500).json({ message: 'Error adding category', error });
  }
};


// Update a category by ID
const updateCategory = async (req, res) => {
  const { categoryId } = req.params;
  const { name } = req.body;

  console.log(`Updating category with ID: ${categoryId}`);

  // Validate categoryId
  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    console.log(`Invalid category ID format: ${categoryId}`);
    return res.status(400).json({ message: 'Invalid category ID format' });
  }

  // Validate new category name
  if (!name) {
    console.log("Category name is required to update");
    return res.status(400).json({ message: 'Category name is required to update' });
  }

  try {
    const updatedCategory = await Category.findByIdAndUpdate(
      categoryId,
      { name },
      { new: true }
    );

    if (!updatedCategory) {
      console.log(`Category with ID ${categoryId} not found`);
      return res.status(404).json({ message: 'Category not found' });
    }

    console.log("Category updated successfully:", updatedCategory);
    res.status(200).json(updatedCategory);
  } catch (error) {
    console.error(`Error updating category with ID ${categoryId}:`, error);
    res.status(500).json({ message: 'Error updating category', error });
  }
};


// Delete a category
const deleteCategory = async (req, res) => {
  const { id } = req.params;

  console.log(`Deleting category with ID: ${id}`);

  // Validate categoryId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    console.log(`Invalid category ID format: ${id}`);
    return res.status(400).json({ message: 'Invalid category ID format' });
  }

  try {
    const deletedCategory = await Category.findByIdAndDelete(id);
    if (!deletedCategory) {
      console.log(`Category with ID ${id} not found`);
      return res.status(404).json({ message: 'Category not found' });
    }

    console.log("Category deleted successfully:", deletedCategory);
    res.status(200).json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error(`Error deleting category with ID ${id}:`, error);
    res.status(500).json({ message: 'Error deleting category', error });
  }
};



// Get all animals
const getAnimals = async (req, res) => {
  try {
    const animals = await Animal.find().populate('category');
    res.status(200).json(animals);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching animals', error });
  }
};

// Add an animal
const addAnimal = async (req, res) => {
  try {
    const { name } = req.body; // Extract `name` from the request body
    const { categoryId } = req.params; // Extract `categoryId` from URL params
    const image = req.file ? `/uploads/animals/${req.file.filename}` : null; // Handle the uploaded image path
    
    // Validate required fields
    if (!categoryId ) {
    return res.status(400).json({ message: 'Missing Category Id' });
    }        if (!name  ) {
    return res.status(400).json({ message: 'Missing Image required fields.' });
    }        if ( !image ) {
    return res.status(400).json({ message: 'Missing required fields.' });
    }
    // if (!categoryId || !name || !image) {
    //   return res.status(400).json({ message: 'Missing required fields.' });
    // }

    // Validate the category
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Create and save the new animal
    const newAnimal = new Animal({
      name,
      image,
      category: category._id,
    });

    await newAnimal.save();

    res.status(201).json({
      message: 'Animal added successfully.',
      animal: newAnimal,
    });
  } catch (error) {
    console.error('Error adding animal:', error);
    res.status(500).json({
      message: 'Internal server error while adding animal.',
      error: error.message,
    });
  }
};



// Delete an animal
const deleteAnimal = async (req, res) => {
  try {
    const { id } = req.params;
    await Animal.findByIdAndDelete(id);
    res.status(200).json({ message: 'Animal deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting animal', error });
  }
};

const getAnimalsByCategoryId = async (req, res) => {
  const { categoryId } = req.params;

  console.log('Received categoryId:', categoryId); // Log category ID

  try {
    const animals = await Animal.find({ category: categoryId }).populate('category');

    console.log('Fetched animals:', animals); // Log animals

    if (animals.length === 0) {
      return res.status(404).json({ message: 'No animals found in this category' });
    }

    res.status(200).json(animals);
  } catch (error) {
    console.error('Error:', error); // Log any error
    res.status(500).json({ message: 'Error fetching animals by category ID', error });
  }
};



// Controller for filtering animals by category name
const getAnimalsByCategoryName = async (req, res) => {
  const { categoryName } = req.params;

  try {
    // Find the category by name
    const category = await Category.findOne({ name: categoryName });

    // If no category is found
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Find all animals that belong to the found category
    const animals = await Animal.find({ category: category._id }).populate('category');
    
    // If no animals are found
    if (animals.length === 0) {
      return res.status(404).json({ message: 'No animals found in this category' });
    }

    // Return the animals in the specified category
    res.status(200).json(animals);
  } catch (error) {
    // Error handling
    res.status(500).json({ message: 'Error fetching animals by category name', error });
  }
};



// Routes
// Category Routes

// Get all categories
app.get('/api/categories', getCategories);

// Add a new category
app.post('/api/category', addCategory);

// Get category by ID (along with all animals in this category)
app.get('/api/category/:categoryId', getCategoryById);

// Update category by ID
app.put('/api/category/:categoryId', updateCategory);

// Delete category by ID
app.delete('/api/category/:id', deleteCategory);



// Animal Routes
app.get('/api/animals', getAnimals);
app.post('/api/animal/category/:categoryId', uploadAnimalImage, addAnimal); // Use uploadAnimalImage as middleware
app.delete('/api/animals/:id', deleteAnimal);
// Routes for fetching animals by category ID or name
// Get animals by category (by category ID)

// Alternatively, if you'd prefer to filter by category name:
app.get('/api/animals/category/:categoryId', getAnimalsByCategoryId);
app.get('/api/animals/category/name/:categoryName', getAnimalsByCategoryName);



// Start server
const PORT = process.env.PORT || 9000;
app.listen(PORT, () => {
  console.log(`Server started at http://localhost:${PORT}`);
});
