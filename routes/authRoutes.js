const express = require('express');
const router = express.Router();

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

router.post('/register', async (req, res) => {
  const hash = await bcrypt.hash(req.body.password, 10);

  const admin = await Admin.create({
    username: req.body.username,
    password: hash
  });

  res.json(admin);
});

router.post('/login', async (req, res) => {
  const admin = await Admin.findOne({ username: req.body.username });

  if (!admin) return res.status(400).json({ msg: "No user" });

  const ok = await bcrypt.compare(req.body.password, admin.password);

  if (!ok) return res.status(401).json({ msg: "Wrong password" });

  const token = jwt.sign({ id: admin._id }, "secret_key");

  res.json({ token });
});

module.exports = router;