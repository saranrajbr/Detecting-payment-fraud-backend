require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Get credentials from command-line args or use defaults
const adminName = process.argv[2] || 'Admin';
const adminEmail = process.argv[3] || 'admin@fraudsystem.com';
const adminPassword = process.argv[4] || 'Admin@1234';

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

const run = async () => {
    console.log('🔗 Connecting to MongoDB Atlas...');
    console.log('ℹ️  Ensure your local IP is whitelisted in MongoDB Atlas Network Access.\n');

    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 15000
        });
        console.log('✅ Connected!\n');

        const hashed = await bcrypt.hash(adminPassword, 10);
        const existing = await User.findOne({ email: adminEmail });

        if (existing) {
            existing.role = 'admin';
            existing.password = hashed;
            await existing.save({ validateBeforeSave: false });
            console.log(`⬆️  Existing user "${existing.name}" promoted to Admin.`);
        } else {
            await User.create({ name: adminName, email: adminEmail, password: hashed, role: 'admin' });
            console.log('✅ New Admin user created!');
        }

        console.log('\n-----------------------------------');
        console.log(`📧 Email   : ${adminEmail}`);
        console.log(`🔑 Password: ${adminPassword}`);
        console.log('Role     : admin');
        console.log('-----------------------------------\n');
        process.exit(0);
    } catch (err) {
        if (err.message.includes('Could not connect') || err.name === 'MongoServerSelectionError') {
            console.error('\n❌ Connection failed! Your IP is not whitelisted in MongoDB Atlas.');
            console.error('   Fix: Go to Atlas → Network Access → Add IP Address → Add 0.0.0.0/0 (Allow from anywhere)\n');
        } else {
            console.error('❌ Error:', err.message);
        }
        process.exit(1);
    }
};

run();
