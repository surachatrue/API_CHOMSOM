require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
const app = express();
const PORT = process.env.PORT || 3000;
const os = require("os");
const cors = require("cors");
// ใช้ Middleware รองรับ JSON
app.use(express.json());

app.use(cors({
  origin: "*", // หรือกำหนดเป็น ["http://example.com", "http://localhost:3000"]
  methods: ["GET", "POST", "PUT", "DELETE"], // อนุญาตเฉพาะเมธอดที่ใช้
  allowedHeaders: ["Content-Type", "Authorization"] // อนุญาตเฉพาะ header ที่ใช้
}));

// const allowedIPs = ["192.168.1.100", "192.168.1.101", "127.0.0.1","192.168.137.1"]; // สามารถปรับเป็น .env ได้

// // Middleware ตรวจสอบ IP
// const allowedSubnet = ["192.168.137.1","127.0.0.1"]; // Subnet ของ LAN/WiFi

// const ipFilter = (req, res, next) => {
//   let clientIP = req.ip || req.connection.remoteAddress;

//   // แปลง IPv6 localhost (::1) เป็น IPv4 localhost (127.0.0.1)
//   if (clientIP === "::1") clientIP = "127.0.0.1";

//   // ตรวจสอบว่า IP อยู่ใน Subnet ที่อนุญาตหรือไม่
//   const isAllowed = allowedSubnet.some((subnet) => clientIP.startsWith(subnet));

//   if (!isAllowed) {
//     return res
//       .status(403)
//       .json({ error: `Access denied. Unauthorized IP address: ${clientIP}` });
//   }

//   next(); // หาก IP อยู่ใน Subnet ให้ดำเนินการต่อ
// };

// app.use((req, res, next) => {
//   const clientIP = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
//   console.log("Client IP:", clientIP); // แสดง IP Address ของ Client
//   next();
// });

const getNetworkIPs = () => {
  const networkInterfaces = os.networkInterfaces(); // ดึงข้อมูลเครือข่ายทั้งหมด
  const ips = [];

  // วนลูปเพื่อดึง IP ของแต่ละอินเทอร์เฟซ
  for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName];

    for (const net of interfaces) {
      if (net.family === "IPv4" && !net.internal) {
        // IPv4 เท่านั้น และไม่ใช่ localhost (::1 หรือ 127.0.0.1)
        ips.push({
          interface: interfaceName,
          address: net.address,
        });
      }
    }
  }

  return ips;
};

// แสดงผล IP ที่ใช้งาน
const networkIPs = getNetworkIPs();
console.log("Network Interfaces and IPs:", networkIPs);

// ใช้ Middleware สำหรับทุก API
// app.use(ipFilter);

// สร้างการเชื่อมต่อฐานข้อมูล
let db;
(async () => {
  db = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
  });
  console.log("Connected to MySQL database.");
})();

app.get("/get_data_user", async (req, res) => {
  try {
    const [results] = await db.query(`
      SELECT 
        u.id AS user_id, 
        u.title, 
        u.first_name, 
        u.last_name, 
        u.mobile_phone, 
        u.role, 
        u.breach,
        u.membership_status, 
        u.eudr_status, 
        ud.nickname, 
        ud.id_card_number, 
        ud.birth_date, 
        ud.address, 
        ud.phone, 
        ud.owner_percentage, 
        ud.credit_percentage, 
        ud.role_eudr, 
        ud.field_area, 
        ud.bank_account, 
        lt.id AS land_id,
        lt.title_deed_no,
        lt.land_location,
        lt.land_area,
        lt.ownership_type,
        lt.acquired_date,
        lt.land_value
      FROM user u
      LEFT JOIN user_details ud ON u.id = ud.user_id
      LEFT JOIN land_titles lt ON lt.id = u.id  
    `);

    // 🔹 จัดกลุ่มข้อมูลโดยใช้ user_id เป็น key
    const userMap = new Map();
    
    results.forEach(row => {
      if (!userMap.has(row.user_id)) {
        userMap.set(row.user_id, {
          user_id: row.user_id,
          title: row.title,
          first_name: row.first_name,
          last_name: row.last_name,
          mobile_phone: row.mobile_phone,
          role: row.role,
          breach: row.breach,
          membership_status: row.membership_status,
          eudr_status: row.eudr_status,
          nickname: row.nickname,
          id_card_number: row.id_card_number,
          birth_date: row.birth_date,
          address: row.address,
          phone: row.phone,
          owner_percentage: row.owner_percentage,
          credit_percentage: row.credit_percentage,
          role_eudr: row.role_eudr,
          field_area: row.field_area,
          bank_account: row.bank_account,
          lands: [] // 🏡 สร้าง array สำหรับเก็บที่ดิน
        });
      }

      if (row.land_id) {
        userMap.get(row.user_id).lands.push({
          land_id: row.land_id,
          title_deed_no: row.title_deed_no,
          land_location: row.land_location,
          land_area: row.land_area,
          ownership_type: row.ownership_type,
          acquired_date: row.acquired_date,
          land_value: row.land_value
        });
      }
    });

    res.status(200).json({
      message: "User data retrieved successfully.",
      data: Array.from(userMap.values())
    });
  } catch (error) {
    console.error("❌ Error retrieving user data:", error);
    res.status(500).json({ error: "Failed to retrieve user data." });
  }
});



app.get("/get_data_user/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [results] = await db.query(
      `
      SELECT 
        u.id AS user_id, 
        u.title, 
        u.first_name, 
        u.last_name, 
        u.mobile_phone, 
        u.role, 
        u.breach,
        u.membership_status, 
        u.eudr_status, 
        ud.nickname, 
        ud.id_card_number, 
        ud.birth_date, 
        ud.address, 
        ud.phone, 
        ud.owner_percentage, 
        ud.credit_percentage, 
        ud.role_eudr, 
        ud.field_area, 
        ud.bank_account, 
        lt.id AS land_id,
        lt.title_deed_no,
        lt.land_location,
        lt.land_area,
        lt.ownership_type,
        lt.acquired_date,
        lt.land_value
      FROM user u
      LEFT JOIN user_details ud ON u.id = ud.user_id
      LEFT JOIN land_titles lt ON lt.id = u.id
      WHERE u.id = ?
      `,
      [id]
    );

    if (results.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    // จัดรูปแบบข้อมูลให้อยู่ในรูปแบบ JSON
    const userData = {
      user_id: results[0].user_id,
      title: results[0].title,
      first_name: results[0].first_name,
      last_name: results[0].last_name,
      mobile_phone: results[0].mobile_phone,
      role: results[0].role,
      breach:results[0].breach,
      membership_status: results[0].membership_status,
      eudr_status: results[0].eudr_status,
      nickname: results[0].nickname,
      id_card_number: results[0].id_card_number,
      birth_date: results[0].birth_date,
      address: results[0].address,
      phone: results[0].phone,  
      owner_percentage: results[0].owner_percentage,
      credit_percentage: results[0].credit_percentage,
      role_eudr: results[0].role_eudr,
      field_area: results[0].field_area,
      bank_account: results[0].bank_account,
      lands: []
    };

    results.forEach(row => {
      if (row.land_id) {
        userData.lands.push({
          land_id: row.land_id,
          title_deed_no: row.title_deed_no,
          land_location: row.land_location,
          land_area: row.land_area,
          ownership_type: row.ownership_type,
          acquired_date: row.acquired_date,
          land_value: row.land_value
        });
      }
    });

    res.status(200).json({
      message: "User data retrieved successfully.",
      data: userData
    });
  } catch (error) {
    console.error("Error retrieving user data:", error);
    res.status(500).json({ error: "Failed to retrieve user data." });
  }
});



// API เพิ่มข้อมูลใน `user` และ `user_details`
app.post("/user-with-details", async (req, res) => {
  const {
    id, // ใช้ id เดียวกันกับ user
    title,
    first_name,
    last_name,
    mobile_phone,
    role,
    breach,
    membership_status,
    eudr_status,
    nickname,
    id_card_number,
    birth_date,
    address,
    phone,
    owner_percentage,
    credit_percentage,
    role_eudr,
    field_area,
    bank_account,
    land // ที่ดินของ user (object หรือ array)
  } = req.body;

  if (!id || !first_name || !last_name || !mobile_phone) {
    return res.status(400).json({ error: "ID, First Name, Last Name, and Mobile Phone are required." });
  }

  try {
    // เริ่ม Transaction
    await db.beginTransaction();

    // ✅ 1. Insert ข้อมูล `user`
    await db.query(
      `
      INSERT INTO user (id, title, first_name, last_name, mobile_phone, role ,breach, membership_status, eudr_status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [id, title || null, first_name, last_name, mobile_phone, role || "user", membership_status || 0, eudr_status || 0]
    );

    // ✅ 2. Insert ข้อมูล `user_details`
    await db.query(
      `
      INSERT INTO user_details (
        id, user_id, nickname, id_card_number, birth_date, address, phone, 
        owner_percentage, credit_percentage, role_eudr, field_area, bank_account, land_title_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id, id, nickname || null, id_card_number || null, birth_date || null, address || null, phone || null,
        owner_percentage || 0.0, credit_percentage || 0.0, role_eudr || null, field_area || null, bank_account || null, id
      ]
    );

    // ✅ 3. Insert ข้อมูล `land_titles` (ถ้ามีที่ดิน)
    if (land) {
      if (Array.isArray(land)) {
        for (const l of land) {
          await db.query(
            `
            INSERT INTO land_titles (id, title_deed_no, land_location, land_area, ownership_type, acquired_date, land_value) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            [
              id, // ใช้ `user.id` เป็น `id` ของ land_titles
              l.title_deed_no || null,
              l.land_location || null,
              l.land_area || 0.0,
              l.ownership_type || null,
              l.acquired_date || null,
              l.land_value || 0.0
            ]
          );
        }
      } else {
        await db.query(
          `
          INSERT INTO land_titles (id, title_deed_no, land_location, land_area, ownership_type, acquired_date, land_value) 
          VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [
            id, // ใช้ `user.id` เป็น `id` ของ land_titles
            land.title_deed_no || null,
            land.land_location || null,
            land.land_area || 0.0,
            land.ownership_type || null,
            land.acquired_date || null,
            land.land_value || 0.0
          ]
        );
      }
    }

    // ✅ Commit Transaction
    await db.commit();

    res.status(201).json({
      message: "User, user details, and land information inserted successfully.",
      userId: id,
    });
  } catch (error) {
    // ❌ Rollback Transaction หากมีข้อผิดพลาด
    await db.rollback();
    console.error("Error inserting user, details, and land:", error);
    res.status(500).json({ error: "Failed to insert user, details, and land information." });
  }
});

app.post("/add-land", async (req, res) => {
  const { user_id, land } = req.body; // รับค่า user_id และ land

  // ตรวจสอบข้อมูลที่จำเป็น
  if (!user_id || !land) {
    return res.status(400).json({ error: "User ID and land data are required." });
  }

  try {
    // ตรวจสอบว่ามี user_id อยู่ในระบบหรือไม่
    const [userCheck] = await db.query("SELECT id FROM user WHERE id = ?", [user_id]);
    if (userCheck.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    // เริ่ม Transaction
    await db.beginTransaction();

    if (Array.isArray(land)) {
      // ถ้ามีหลายแปลง -> Loop Insert
      for (const l of land) {
        await db.query(
          `
          INSERT INTO land_titles (id, title_deed_no, land_location, land_area, ownership_type, acquired_date, land_value) 
          VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [
            user_id, // ใช้ user_id เป็น id ของที่ดิน
            l.title_deed_no || null,
            l.land_location || null,
            l.land_area || 0.0,
            l.ownership_type || null,
            l.acquired_date || null,
            l.land_value || 0.0
          ]
        );
      }
    } else {
      // ถ้ามีแปลงเดียว -> Insert ปกติ
      await db.query(
        `
        INSERT INTO land_titles (id, title_deed_no, land_location, land_area, ownership_type, acquired_date, land_value) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          user_id, // ใช้ user_id เป็น id ของที่ดิน
          land.title_deed_no || null,
          land.land_location || null,
          land.land_area || 0.0,
          land.ownership_type || null,
          land.acquired_date || null,
          land.land_value || 0.0
        ]
      );
    }

    // Commit Transaction
    await db.commit();

    res.status(201).json({
      message: "Land information inserted successfully.",
      userId: user_id,
    });
  } catch (error) {
    // Rollback Transaction หากมีข้อผิดพลาด
    await db.rollback();
    console.error("Error inserting land:", error);
    res.status(500).json({ error: "Failed to insert land information." });
  }
});




// API ลบข้อมูลใน user และ user_details
app.delete("/delete_user/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // เริ่ม Transaction
    await db.beginTransaction();

    // 🔹 ลบข้อมูลใน `land_titles` (ที่ดินของผู้ใช้)
    await db.query("DELETE FROM land_titles WHERE id = ?", [id]);

    // 🔹 ลบข้อมูลใน `user_details`
    await db.query("DELETE FROM user_details WHERE user_id = ?", [id]);

    // 🔹 ลบข้อมูลใน `auth` (ถ้ามีระบบล็อกอิน)
    await db.query("DELETE FROM auth WHERE user_id = ?", [id]);

    // 🔹 ลบข้อมูลใน `user`
    const [result] = await db.query("DELETE FROM user WHERE id = ?", [id]);

    // หากไม่มีข้อมูลใน `user` ให้แจ้งว่าไม่พบ
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    // ✅ Commit Transaction
    await db.commit();

    res.status(200).json({ message: `User with ID ${id} and all related data deleted successfully.` });

  } catch (error) {
    // ❌ Rollback Transaction หากมีข้อผิดพลาด
    await db.rollback();
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Failed to delete user and related data." });
  }
});



app.post("/login", async (req, res) => {
  console.log(req.body);
  const { username, password ,breach} = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    // 🔹 ดึงข้อมูลผู้ใช้จาก database
    const [users] = await db.query("SELECT * FROM auth WHERE email = ? AND password = ? AND breach = ? LIMIT 1", [username,password ,breach]);

    if (users.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    const user = users[0];

    // 🔹 ตรวจสอบรหัสผ่าน 
    const isPasswordValid =  user.password;
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid password." });
    }

    // 🔹 ส่งข้อมูลผู้ใช้กลับไป
    res.status(200).json({
      status: 200,
      message: "Login successful.",
      userId: user.id,
      username: user.username,
    });

  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ error: "Failed to log in." });
  }
});



// API อัปเดตข้อมูลใน user และ user_details
app.put("/update_user/:id", async (req, res) => {
  const { id } = req.params;
  const {
    title,
    first_name,
    last_name,
    mobile_phone,
    role,
    breach,
    membership_status,
    eudr_status,
    nickname,
    id_card_number,
    birth_date,
    address,
    phone,
    owner_percentage,
    credit_percentage,
    role_eudr,
    field_area,
    bank_account,
    land // 🏡 ข้อมูลที่ดิน (ถ้ามี)
  } = req.body;

  try {
    // เริ่ม Transaction
    await db.beginTransaction();

    // ✅ 1. อัปเดตข้อมูลในตาราง `user`
    const [userResult] = await db.query(
      `
      UPDATE user 
      SET title = ?, first_name = ?, last_name = ?, mobile_phone = ?, role = ?,breach = ?, 
          membership_status = ?, eudr_status = ?
      WHERE id = ?
      `,
      [title, first_name, last_name, mobile_phone, role,breach, membership_status, eudr_status, id]
    );

    // หากไม่มีข้อมูลใน `user` ให้แจ้งว่าไม่พบ
    if (userResult.affectedRows === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    // ✅ 2. อัปเดตข้อมูลในตาราง `user_details`
    await db.query(
      `
      UPDATE user_details 
      SET nickname = ?, id_card_number = ?, birth_date = ?, address = ?, phone = ?, 
          owner_percentage = ?, credit_percentage = ?, role_eudr = ?, field_area = ?, bank_account = ?
      WHERE user_id = ?
      `,
      [nickname, id_card_number, birth_date, address, phone, owner_percentage, credit_percentage, role_eudr, field_area, bank_account, id]
    );

    // ✅ 3. เพิ่มที่ดินใหม่ (ถ้ามีข้อมูลที่ดิน)
    if (land) {
      if (Array.isArray(land)) {
        for (const l of land) {
          await db.query(
            `
            INSERT INTO land_titles (id, title_deed_no, land_location, land_area, ownership_type, acquired_date, land_value) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            [
              id, // ใช้ `user.id` เป็น `id` ของที่ดิน
              l.title_deed_no || null,
              l.land_location || null,
              l.land_area || 0.0,
              l.ownership_type || null,
              l.acquired_date || null,
              l.land_value || 0.0
            ]
          );
        }
      } else {
        await db.query(
          `
          INSERT INTO land_titles (id, title_deed_no, land_location, land_area, ownership_type, acquired_date, land_value) 
          VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [
            id, // ใช้ `user.id` เป็น `id` ของที่ดิน
            land.title_deed_no || null,
            land.land_location || null,
            land.land_area || 0.0,
            land.ownership_type || null,
            land.acquired_date || null,
            land.land_value || 0.0
          ]
        );
      }
    }

    // ✅ Commit Transaction
    await db.commit();

    res.status(200).json({ 
      message: `User with ID ${id} updated successfully.`,
      userId: id 
    });

  } catch (error) {
    // ❌ Rollback Transaction หากมีข้อผิดพลาด
    await db.rollback();
    console.error("Error updating user and land:", error);
    res.status(500).json({ error: "Failed to update user and land information." });
  }
});


// เริ่มเซิร์ฟเวอร์
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
