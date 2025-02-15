require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
// const bcrypt = require("bcrypt");
const app = express();
const PORT = process.env.DB_PORT || 3000;
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
        c.id AS customer_id, 
        c.title, 
        c.first_name, 
        c.last_name, 
        c.mobile_phone, 
        c.breach,
        c.membership_status, 
        c.eudr_status, 
        c.bank_account,
        c.owner_percentage,
        c.credit_percentage,
        lt.id AS land_id,
        lt.title_deed_no,
        lt.land_location,
        lt.land_area,
        lt.ownership_type,
        lt.acquired_date,
        lt.land_value
      FROM customer c
      LEFT JOIN customer_land cl ON c.id = cl.customer_id
      LEFT JOIN land_titles lt ON cl.land_id = lt.id
    `);

    const customerMap = new Map();
    
    results.forEach(row => {
      if (!customerMap.has(row.customer_id)) {
        customerMap.set(row.customer_id, {
          customer_id: row.customer_id,
          title: row.title,
          first_name: row.first_name,
          last_name: row.last_name,
          mobile_phone: row.mobile_phone,
          breach: row.breach,
          membership_status: row.membership_status,
          eudr_status: row.eudr_status,
          bank_account: row.bank_account,
          owner_percentage: row.owner_percentage,
          credit_percentage: row.credit_percentage,
          lands: []
        });
      }

      if (row.land_id) {
        customerMap.get(row.customer_id).lands.push({
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
      message: "Customer data retrieved successfully.",
      data: Array.from(customerMap.values())
    });
  } catch (error) {
    console.error("Error retrieving customer data:", error);
    res.status(500).json({ error: "Failed to retrieve customer data." });
  }
});

// -- API สำหรับดึงข้อมูลลูกค้ารายบุคคล
app.get("/get_data_user/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [results] = await db.query(
      `
      SELECT 
        c.id AS customer_id, 
        c.title, 
        c.first_name, 
        c.last_name, 
        c.mobile_phone, 
        c.breach,
        c.membership_status, 
        c.eudr_status, 
        cd.field_area,
        c.bank_account,
        c.owner_percentage,
        c.credit_percentage,
        lt.id AS land_id,
        lt.title_deed_no,
        lt.land_location,
        lt.land_area,
        lt.ownership_type,
        lt.acquired_date,
        lt.land_value
      FROM customer c
      LEFT JOIN customer_details cd ON c.id = cd.customer_id
      LEFT JOIN customer_land cl ON c.id = cl.customer_id
      LEFT JOIN land_titles lt ON cl.land_id = lt.id
      WHERE c.id = ?
      `,
      [id]
    );

    if (results.length === 0) {
      return res.status(404).json({ error: "Customer not found." });
    }

    const customerData = {
      customer_id: results[0].customer_id,
      title: results[0].title,
      first_name: results[0].first_name,
      last_name: results[0].last_name,
      mobile_phone: results[0].mobile_phone,
      breach: results[0].breach,
      membership_status: results[0].membership_status,
      eudr_status: results[0].eudr_status,
      field_area: results[0].field_area,
      bank_account: results[0].bank_account,
      owner_percentage: results[0].owner_percentage,
      credit_percentage: results[0].credit_percentage,
      lands: []
    };

    results.forEach(row => {
      if (row.land_id) {
        customerData.lands.push({
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
      message: "Customer data retrieved successfully.",
      data: customerData
    });
  } catch (error) {
    console.error("Error retrieving customer data:", error);
    res.status(500).json({ error: "Failed to retrieve customer data." });
  }
});


// API เพิ่มข้อมูลใน `user` และ `user_details`
app.post("/user-with-details", async (req, res) => {
  const data = req.body;

  const {
    id, // ใช้ id เดียวกันกับ customer
    title,
    first_name,
    last_name,
    mobile_phone,
    bank_account,
    owner_percentage,
    credit_percentage,
    breach,
    membership_status,
    eudr_status,
    created_at,
    updated_at,
    land // ที่ดินของ customer (object หรือ array)
  } = data;

  console.log(data);

  if (!id || !first_name || !last_name || !mobile_phone) {
    return res.status(400).json({ error: "ID, First Name, Last Name, and Mobile Phone are required." });
  }

  try {
    // เริ่ม Transaction
    await db.beginTransaction();

    // 👉 1. Insert ข้อมูล `customer`
    await db.query(
      `
      INSERT INTO customer (
        id, title, first_name, last_name, mobile_phone, 
        bank_account, owner_percentage, credit_percentage, 
        breach, membership_status, eudr_status, created_at, updated_at
      ) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id, title || null, first_name, last_name, mobile_phone, 
        bank_account || null, owner_percentage || 0.0, credit_percentage || 0.0, 
        breach || null, membership_status || 0, eudr_status || 0, 
        created_at ? new Date(created_at) : new Date(), 
        updated_at ? new Date(updated_at) : new Date()
      ]
    );

    // 👉 2. Insert ข้อมูล `customer_details`
    await db.query(
      `
      INSERT INTO customer_details (
        id, customer_id, owner_percentage, credit_percentage, field_area
      )
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        id, id, owner_percentage || 0.0, credit_percentage || 0.0, 
        data.field_area || null
      ]
    );

    // 👉 3. Insert ข้อมูล `land_titles` และเชื่อมโยงกับ `customer_land`
    if (land) {
      const insertLand = async (landItem) => {
        // Insert ข้อมูลที่ดิน
        await db.query(
          `
          INSERT INTO land_titles (
            id, title_deed_no, land_location, land_area, 
            ownership_type, acquired_date, land_value, 
            created_at, updated_at
          ) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            landItem.id, // ใช้ id ของที่ดิน
            landItem.title_deed_no || null,
            landItem.land_location || null,
            landItem.land_area || 0.0,
            landItem.ownership_type || null,
            landItem.acquired_date || null,
            landItem.land_value || 0.0,
            created_at ? new Date(created_at) : new Date(), 
            updated_at ? new Date(updated_at) : new Date()
          ]
        );

        // เชื่อมโยงลูกค้ากับที่ดินในตาราง customer_land
        await db.query(
          `
          INSERT INTO customer_land (
            id, customer_id, land_id
          ) 
          VALUES (?, ?, ?)
          `,
          [
            `${id}_${landItem.id}`, // unique id สำหรับ customer_land
            id,                    // customer_id
            landItem.id            // land_id
          ]
        );
      };

      if (Array.isArray(land)) {
        for (const landItem of land) {
          await insertLand(landItem);
        }
      } else {
        await insertLand(land);
      }
    }

    // 👉 Commit Transaction
    await db.commit();

    res.status(201).json({
      message: "Customer, customer details, and land information inserted successfully.",
      customerId: id,
    });
  } catch (error) {
    // ❌ Rollback Transaction หากมีข้อผิดพลาด
    await db.rollback();
    console.error("Error inserting customer, details, and land:", error);
    res.status(500).json({ error: "Failed to insert customer, details, and land information." });
  }
});

// -- API สำหรับดึงข้อมูลลูกค้า
app.get("/get_data_user/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [results] = await db.query(
      `
      SELECT 
        c.id AS customer_id, 
        c.title, 
        c.first_name, 
        c.last_name, 
        c.mobile_phone, 
        c.bank_account, 
        c.owner_percentage, 
        c.credit_percentage, 
        c.breach,
        c.membership_status, 
        c.eudr_status, 
        cd.field_area, 
        lt.id AS land_id,
        lt.title_deed_no,
        lt.land_location,
        lt.land_area,
        lt.ownership_type,
        lt.acquired_date,
        lt.land_value
      FROM customer c
      LEFT JOIN customer_details cd ON c.id = cd.customer_id
      LEFT JOIN customer_land cl ON c.id = cl.customer_id
      LEFT JOIN land_titles lt ON cl.land_id = lt.id
      WHERE c.id = ?
      `,
      [id]
    );

    if (results.length === 0) {
      return res.status(404).json({ error: "Customer not found." });
    }

    // จัดรูปแบบข้อมูลให้อยู่ในรูปแบบ JSON
    const customerData = {
      customer_id: results[0].customer_id,
      title: results[0].title,
      first_name: results[0].first_name,
      last_name: results[0].last_name,
      mobile_phone: results[0].mobile_phone,
      bank_account: results[0].bank_account,
      owner_percentage: results[0].owner_percentage,
      credit_percentage: results[0].credit_percentage,
      breach: results[0].breach,
      membership_status: results[0].membership_status,
      eudr_status: results[0].eudr_status,
      field_area: results[0].field_area,
      lands: []
    };

    results.forEach(row => {
      if (row.land_id) {
        customerData.lands.push({
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
      message: "Customer data retrieved successfully.",
      data: customerData
    });
  } catch (error) {
    console.error("Error retrieving customer data:", error);
    res.status(500).json({ error: "Failed to retrieve customer data." });
  }
});




// -- API สำหรับเพิ่มข้อมูลที่ดิน
app.post("/add-land", async (req, res) => {
  const { customer_id, land } = req.body;

  if (!customer_id || !land) {
    return res.status(400).json({ error: "Customer ID and land data are required." });
  }

  try {
    const [customerCheck] = await db.query("SELECT id FROM customer WHERE id = ?", [customer_id]);
    if (customerCheck.length === 0) {
      return res.status(404).json({ error: "Customer not found." });
    }

    await db.beginTransaction();

    const insertLand = async (l) => {
      const landId = `${customer_id}_${Date.now()}`;
      await db.query(
        `
        INSERT INTO land_titles (id, title_deed_no, land_location, land_area, ownership_type, acquired_date, land_value) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          landId,
          l.title_deed_no || null,
          l.land_location || null,
          l.land_area || 0.0,
          l.ownership_type || null,
          l.acquired_date || null,
          l.land_value || 0.0
        ]
      );

      await db.query(
        `
        INSERT INTO customer_land (id, customer_id, land_id) 
        VALUES (?, ?, ?)
        `,
        [`${customer_id}_${landId}`, customer_id, landId]
      );
    };

    if (Array.isArray(land)) {
      for (const l of land) {
        await insertLand(l);
      }
    } else {
      await insertLand(land);
    }

    await db.commit();

    res.status(201).json({ message: "Land information inserted successfully.", customerId: customer_id });
  } catch (error) {
    await db.rollback();
    console.error("Error inserting land:", error);
    res.status(500).json({ error: "Failed to insert land information." });
  }
});

// -- API สำหรับลบข้อมูลลูกค้า
app.delete("/delete_user/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await db.beginTransaction();

    await db.query("DELETE FROM customer_land WHERE customer_id = ?", [id]);
    await db.query("DELETE FROM customer_details WHERE customer_id = ?", [id]);
    await db.query("DELETE FROM auth WHERE customer_id = ?", [id]);
    const [result] = await db.query("DELETE FROM customer WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Customer not found." });
    }

    await db.commit();

    res.status(200).json({ message: `Customer with ID ${id} and all related data deleted successfully.` });
  } catch (error) {
    await db.rollback();
    console.error("Error deleting customer:", error);
    res.status(500).json({ error: "Failed to delete customer and related data." });
  }
});

// -- API สำหรับลบข้อมูลที่ดิน
app.delete("/delete_land/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await db.beginTransaction();

    await db.query("DELETE FROM customer_land WHERE land_id = ?", [id]);
    const [result] = await db.query("DELETE FROM land_titles WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Land not found." });
    }

    await db.commit();

    res.status(200).json({ message: `Land with ID ${id} deleted successfully.` });
  } catch (error) {
    await db.rollback();
    console.error("Error deleting land:", error);
    res.status(500).json({ error: "Failed to delete land information." });
  }
});


app.put("/update_user/:id", async (req, res) => {
  const { id } = req.params;
  const { title, first_name, last_name, mobile_phone, bank_account, owner_percentage, credit_percentage, breach, membership_status, eudr_status, land } = req.body;

  try {
    await db.beginTransaction();

    await db.query(
      `
      UPDATE customer 
      SET title = ?, first_name = ?, last_name = ?, mobile_phone = ?, bank_account = ?, owner_percentage = ?, credit_percentage = ?, breach = ?, membership_status = ?, eudr_status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
      `,
      [title, first_name, last_name, mobile_phone, bank_account, owner_percentage, credit_percentage, breach, membership_status, eudr_status, id]
    );

    if (land) {
      const insertLand = async (l) => {
        const [existingLand] = await db.query("SELECT id FROM land_titles WHERE id = ?", [l.id]);

        if (existingLand.length === 0) {
          await db.query(
            `
            INSERT INTO land_titles (id, title_deed_no, land_location, land_area, ownership_type, acquired_date, land_value) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            [
              l.id,
              l.title_deed_no || null,
              l.land_location || null,
              l.land_area || 0.0,
              l.ownership_type || null,
              l.acquired_date || null,
              l.land_value || 0.0
            ]
          );

          await db.query(
            `
            INSERT INTO customer_land (id, customer_id, land_id) 
            VALUES (?, ?, ?)
            `,
            [`${id}_${l.id}`, id, l.id]
          );
        }else {
          await db.query(
            `
            UPDATE land_titles 
            SET title_deed_no = ?, land_location = ?, land_area = ?, ownership_type = ?, acquired_date = ?, land_value = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            `,
            [
              l.title_deed_no || null,
              l.land_location || null,
              l.land_area || 0.0,
              l.ownership_type || null,
              l.acquired_date || null,
              l.land_value || 0.0,
              l.id
            ]
          );
        }
      };

      if (Array.isArray(land)) {
        for (const l of land) {
          await insertLand(l);
        }
      } else {
        await insertLand(land);
      }
    }

    await db.commit();

    res.status(200).json({ message: "Customer updated successfully." });
  } catch (error) {
    await db.rollback();
    console.error("Error updating customer:", error);
    res.status(500).json({ error: "Failed to update customer data." });
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
    const [users] = await db.query("SELECT * FROM auth WHERE email = ? AND password = ? LIMIT 1", [username,password ,breach]);

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