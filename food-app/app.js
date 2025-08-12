// app.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');

const connectDB = require('./db');
const Food = require('./models/Food');
const User = require('./models/User');
const Order = require('./models/Order');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- API Routes (prefix: /api) ----------

// GET all foods
app.get('/api/foods', async (req, res) => {
  const foods = await Food.find().sort({ createdAt: -1 });
  res.json(foods);
});

// GET single food
app.get('/api/foods/:id', async (req, res) => {
  try {
    const food = await Food.findById(req.params.id);
    if (!food) return res.status(404).json({ error: 'Food not found' });
    res.json(food);
  } catch (err) {
    res.status(400).json({ error: 'Invalid ID' });
  }
});

// Add a new food (admin or public depending on your usage)
app.post('/api/foods', async (req, res) => {
  try {
    const { name, description, price, category, image } = req.body;
    if (!name || price === undefined) {
      return res.status(400).json({ error: 'name and price are required' });
    }
    const food = await Food.create({ name, description, price, category, image });
    res.status(201).json({ message: 'Food added', food });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add food' });
  }
});

// Register
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username & password required' });

    const exists = await User.findOne({ username });
    if (exists) return res.status(400).json({ error: 'Username already exists' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ username, password: hashed, email });
    res.status(201).json({ message: 'Registered', userId: user._id, username: user.username });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login (returns basic user info only — no JWT in demo)
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username & password required' });

    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ error: 'Invalid username or password' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ error: 'Invalid username or password' });

    res.json({ message: 'Login successful', userId: user._id, username: user.username });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Place order
app.post('/api/order', async (req, res) => {
  try {
    const { userId, items } = req.body;
    if (!userId || !Array.isArray(items) || items.length === 0)
      return res.status(400).json({ error: 'userId and items required' });

    let total = 0;
    const itemsToSave = items.map(it => {
      const qty = Number(it.quantity) || 1;
      const price = Number(it.price) || 0;
      total += price * qty;
      return {
        foodId: it.foodId || null,
        name: it.name || '',
        price,
        quantity: qty
      };
    });

    const order = await Order.create({ userId, items: itemsToSave, totalAmount: total });
    res.status(201).json({ message: 'Order placed', orderId: order._id });
  } catch (err) {
    res.status(500).json({ error: 'Order failed' });
  }
});

// Get orders for a user
app.get('/api/users/:id/orders', async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.params.id }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch orders' });
  }
});

// ---------- Seed 25 foods if empty ----------
async function seedFoodsIfEmpty() {
  const count = await Food.countDocuments();
  if (count === 0) {
    console.log('Seeding 25 food items...');
    const categories = ['Burger', 'Pizza', 'Pasta', 'Fries', 'Sandwich'];
    const items = [];
    for (let i = 1; i <= 25; i++) {
      const cat = categories[i % categories.length];
      items.push({
        name: `${cat} ${i}`,
        description: `${cat} delicious #${i}`,
        price: Math.floor(Math.random() * 200) + 80,
        category: cat
      });
    }
    await Food.insertMany(items);
    console.log('Seed complete.');
  } else {
    console.log('Foods already exist, skipping seed.');
  }
}

// ---------- Start server ----------
(async () => {
  await connectDB();
  await seedFoodsIfEmpty();
  app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
})();
