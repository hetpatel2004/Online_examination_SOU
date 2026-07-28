/**
 * Seed Script - Creates Default Admin Accounts + Super Admin
 * 
 * HOW TO RUN:
 * ==========
 * Open terminal and run:
 * node seed.js
 * 
 * This will create:
 * 
 * SUPER ADMIN:
 * - Enrollment: SUPER001
 * - Password: superadmin123
 * - Name: System Administrator
 * 
 * ADMIN 1:
 * - Enrollment: ADMIN001
 * - Password: 123456789012
 * 
 * ADMIN 2:
 * - Enrollment: ADMIN002
 * - Password: 123456789012
 * 
 * ADMIN 3:
 * - Enrollment: ADMIN003
 * - Password: 123456789012
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Course = require('./models/Course');
require('dotenv').config();

// Super Admin Account
const superAdminAccount = {
  name: 'System Administrator',
  enrollmentNumber: 'SUPER001',
  email: 'superadmin@sou.edu',
  phone: '9876543200',
  course: 'Administration',
  semester: 'N/A',
  aadharNumber: 'superadmin123',
  password: 'superadmin123',
  role: 'superadmin'
};

// 3 Default Admin Accounts
const adminAccounts = [
  {
    name: 'Dr. Rajesh Kumar',
    enrollmentNumber: 'ADMIN001',
    email: 'admin@sou.edu',
    phone: '9876543210',
    course: 'Administration',
    semester: 'N/A',
    aadharNumber: '123456789012',
    password: '123456789012',  // Will be hashed
    role: 'admin'
  },
  {
    name: 'Prof. Priya Sharma',
    enrollmentNumber: 'ADMIN002',
    email: 'admin2@sou.edu',
    phone: '9876543211',
    course: 'Administration',
    semester: 'N/A',
    aadharNumber: '123456789012',
    password: '123456789012',  // Will be hashed
    role: 'admin'
  },
  {
    name: 'Dr. Amit Patel',
    enrollmentNumber: 'ADMIN003',
    email: 'admin3@sou.edu',
    phone: '9876543212',
    course: 'Administration',
    semester: 'N/A',
    aadharNumber: '123456789012',
    password: '123456789012',  // Will be hashed
    role: 'admin'
  }
];

// Default courses to seed
const defaultCourses = [
  { name: 'Master of Computer Applications', code: 'MCA', description: 'MCA program covering computer applications and software development', level: 'postgraduation', totalSemesters: 4 },
  { name: 'Master of Science in Information Technology', code: 'MScIT', description: 'MSc IT program covering information technology and systems', level: 'postgraduation', totalSemesters: 4 },
];

async function seedCourses() {
  for (const course of defaultCourses) {
    const existing = await Course.findOne({ code: course.code });
    if (!existing) {
      await Course.create(course);
      console.log(`Course ${course.code} (${course.name}) created`);
    } else {
      if (!existing.level) {
        existing.level = course.level;
        existing.totalSemesters = course.totalSemesters;
        await existing.save();
        console.log(`Course ${course.code} updated with level=${course.level}, totalSemesters=${course.totalSemesters}`);
      } else {
        console.log(`Course ${course.code} already exists - skipping`);
      }
    }
  }
}

async function seedAdmins() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Seed default courses first
    await seedCourses();

    // Create Super Admin first
    const existingSuper = await User.findOne({ enrollmentNumber: superAdminAccount.enrollmentNumber });
    if (existingSuper) {
      console.log(`Super Admin ${superAdminAccount.enrollmentNumber} already exists - skipping`);
    } else {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(superAdminAccount.password, salt);
      const newSuperAdmin = new User({
        ...superAdminAccount,
        password: hashedPassword
      });
      await newSuperAdmin.save();
      console.log(`Super Admin ${superAdminAccount.enrollmentNumber} (${superAdminAccount.name}) created successfully`);
    }

    // Loop through each admin account
    for (const admin of adminAccounts) {
      // Check if admin already exists by enrollment number
      const existing = await User.findOne({ enrollmentNumber: admin.enrollmentNumber });
      
      if (existing) {
        console.log(`Admin ${admin.enrollmentNumber} already exists - skipping`);
        continue;
      }

      // Hash the password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(admin.password, salt);

      // Create new admin user
      const newAdmin = new User({
        name: admin.name,
        enrollmentNumber: admin.enrollmentNumber,
        email: admin.email,
        phone: admin.phone,
        course: admin.course,
        semester: admin.semester,
        aadharNumber: admin.aadharNumber,
        password: hashedPassword,
        role: 'admin'
      });

      await newAdmin.save();
      console.log(`Admin ${admin.enrollmentNumber} (${admin.name}) created successfully`);
    }

    console.log('\n========================================');
    console.log('DEFAULT ACCOUNTS:');
    console.log('========================================');
    console.log('Super Admin: SUPER001 / superadmin123');
    console.log('Admin 1: ADMIN001 / 123456789012');
    console.log('Admin 2: ADMIN002 / 123456789012');
    console.log('Admin 3: ADMIN003 / 123456789012');
    console.log('========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding admins:', error);
    process.exit(1);
  }
}

seedAdmins();
