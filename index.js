require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
// const bcrypt = require("bcrypt");
const app = express();
const PORT =3000;
const os = require("os");
const cors = require("cors");
// ใช้ Middleware รองรับ JSON
app.use(express.json());

//test auto fetch
app.use(cors({
  origin: "*", // หรือกำหนดเป็น ["http://example.com", "http://localhost:3000"]
  methods: ["GET", "POST", "PUT", "DELETE"], // อนุญาตเฉพาะเมธอดที่ใช้
  allowedHeaders: ["Content-Type", "Authorization"] // อนุญาตเฉพาะ header ที่ใช้
}));

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
  const { email, password } = req.body;

  if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
  }

  try {
      // 🔹 ดึงข้อมูลจาก `auth`
      const [users] = await db.query("SELECT * FROM auth WHERE email = ? LIMIT 1", [email]);

      if (users.length === 0) {
          return res.status(404).json({ error: "User not found." });
      }

      const user = users[0];

      // 🔹 ตรวจสอบว่าบัญชีถูกระงับหรือไม่
      if (user.breach === 1) {
          return res.status(403).json({ error: "Your account has been suspended. Please contact support." });
      }

      // 🔹 ตรวจสอบรหัสผ่าน
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
          return res.status(401).json({ error: "Invalid password." });
      }

      // 🔹 ดึงข้อมูลพนักงานจาก `employees`
      const [employees] = await db.query("SELECT * FROM employees WHERE email = ? LIMIT 1", [email]);
      if (employees.length === 0) {
          return res.status(404).json({ error: "Employee record not found." });
      }

      const employee = employees[0];

    

      res.status(200).json({
          message: "Login successful.",
          token,
          user: {
              id: employee.id,
              username: employee.username,
              email: employee.email,
              branch_id: employee.branch_id,
              role: employee.role,
          },
      });

  } catch (error) {
      console.error("Error logging in:", error);
      res.status(500).json({ error: "Failed to log in." });
  }
});


app.post("/register", async (req, res) => {
  const { username, email, password, branch_code, role } = req.body;

  if (!username || !email || !password || !branch_code) {
      return res.status(400).json({ error: "All fields are required." });
  }

  try {
      // 🔹 เช็คว่า branch_code มีอยู่หรือไม่
      const [branch] = await db.query("SELECT id FROM branch WHERE branch_code = ? LIMIT 1", [branch_code]);
      if (branch.length === 0) {
          return res.status(400).json({ error: "Invalid branch code." });
      }
      const branch_id = branch[0].id;

      // 🔹 เข้ารหัส password
      const hashedPassword = await bcrypt.hash(password, 10);

      // 🔹 เพิ่มข้อมูลเข้า `auth`
      await db.query(`INSERT INTO auth (email, password, branch_code) VALUES (?, ?, ?)`, [email, hashedPassword, branch_code]);

      // 🔹 เพิ่มข้อมูลเข้า `employees`
      await db.query(`INSERT INTO employees (branch_id, username, email, role) VALUES (?, ?, ?, ?)`, 
          [branch_id, username, email, role || "staff"]
      );

      res.status(201).json({ message: "Employee registered successfully." });
  } catch (error) {
      console.error("Error registering employee:", error);
      res.status(500).json({ error: "Failed to register employee." });
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

app.post('/add_branch', async (req, res) => {
  try {
      const {
          branch_name, branch_code, phone_number, email, branch_type,
          house_number, village_name, moo, road, sub_district, district,
          province, postal_code, latitude, longitude
      } = req.body;

      if (!branch_name || !branch_code) {
          return res.status(400).json({ error: 'Branch name and code are required' });
      }

      const checkBranch = await db.query(`SELECT id FROM branch WHERE branch_code = ?`, [branch_code]);
      if (checkBranch[0].length > 0) {
          return res.status(409).json({ error: 'Branch code already exists' });
      }

      const sql = `INSERT INTO branch (
          branch_name, branch_code, phone_number, email, branch_type,
          house_number, village_name, moo, road, sub_district, district,
          province, postal_code, latitude, longitude
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      const values = [
          branch_name, branch_code, phone_number, email, branch_type,
          house_number, village_name, moo, road, sub_district, district,
          province, postal_code, latitude, longitude
      ];

      const [result] = await db.query(sql, values);
      res.status(201).json({ message: 'Branch added successfully', branch_id: result.insertId });
  } catch (err) {
      res.status(500).json({ error: 'Database error', details: err });
  }
});

app.post("/logout", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1]; // รับ Token จาก Header

  if (!token) {
      return res.status(400).json({ error: "Token is required." });
  }

  try {
      // 🔹 เก็บ Token ลง Blacklist
      await db.query("INSERT INTO token_blacklist (token) VALUES (?)", [token]);

      res.status(200).json({ message: "Logged out successfully." });
  } catch (error) {
      console.error("Error logging out:", error);
      res.status(500).json({ error: "Failed to log out." });
  }
});
const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
      return res.status(401).json({ error: "Unauthorized." });
  }

  try {
      // 🔹 ตรวจสอบว่า Token อยู่ใน Blacklist หรือไม่
      const [blacklisted] = await db.query("SELECT * FROM token_blacklist WHERE token = ? LIMIT 1", [token]);

      if (blacklisted.length > 0) {
          return res.status(401).json({ error: "Token has been logged out." });
      }

      req.user = decoded;
      next();
  } catch (error) {
      return res.status(401).json({ error: "Invalid or expired token." });
  }
};

// ใช้ Middleware นี้กับ API ที่ต้องการให้ล็อกอินก่อนใช้งาน
app.get("/profile", verifyToken, (req, res) => {
  res.json({ message: "This is a protected route.", user: req.user });
});

app.post('/add_rubber_transaction', async (req, res) => {
  try {
      const { receipt_number, branch_id, customer_id, total_amount, items } = req.body;

      if (!receipt_number || !branch_id || !customer_id || !items || items.length === 0) {
          return res.status(400).json({ error: 'Missing required fields or items' });
      }

      const receiptSql = `INSERT INTO receipts (receipt_number, branch_id, customer_id, total_amount) VALUES (?, ?, ?, ?)`;
      const [receiptResult] = await db.query(receiptSql, [receipt_number, branch_id, customer_id, total_amount]);
      const receiptId = receiptResult.insertId;

      const itemSql = `INSERT INTO receipt_items (receipt_id, product_name, quantity, unit_price, total_price) VALUES ?`;
      const itemValues = items.map(item => [receiptId, item.product_name, item.quantity, item.unit_price, item.total_price]);
      await db.query(itemSql, [itemValues]);

      res.status(201).json({ message: 'Rubber transaction added successfully', receipt_id: receiptId });
  } catch (error) {
      console.error("Error adding rubber transaction:", error);
      res.status(500).json({ error: "Failed to add rubber transaction." });
  }
});
app.get('/get_data_branch', async (req, res) => {
  try {
      const [results] = await db.query(`
          SELECT 
              b.id AS branch_id,
              b.branch_name,
              b.branch_code,
              b.phone_number,
              b.email,
              b.branch_type,
              b.house_number,
              b.village_name,
              b.moo,
              b.road,
              b.sub_district,
              b.district,
              b.province,
              b.postal_code,
              b.latitude,
              b.longitude
          FROM branch b
      `);

      res.status(200).json({
          message: "Branch data retrieved successfully.",
          data: results
      });
  } catch (error) {
      console.error("Error retrieving branch data:", error);
      res.status(500).json({ error: "Failed to retrieve branch data." });
  }
});
// เส้นทางดึงข้อมูลใบเสร็จพร้อมรายละเอียดสินค้า
app.get('/get_rubber_transactions', async (req, res) => {
  try {
      const [results] = await db.query(`
          SELECT 
              r.id AS receipt_id, 
              r.receipt_number, 
              r.branch_id, 
              r.customer_id, 
              r.total_amount, 
              r.created_at,
              ri.product_name,
              ri.quantity,
              ri.unit_price,
              ri.total_price
          FROM receipts r
          LEFT JOIN receipt_items ri ON r.id = ri.receipt_id
      `);
      
      res.status(200).json({
          message: "Rubber transaction data retrieved successfully.",
          data: results
      });
  } catch (error) {
      console.error("Error retrieving rubber transactions:", error);
      res.status(500).json({ error: "Failed to retrieve rubber transactions." });
  }
});

app.get('/get_rubber_transactions/:customer_id', async (req, res) => {
  try {
      const { customer_id } = req.params;
      const [results] = await db.query(`
          SELECT 
              r.id AS receipt_id, 
              r.receipt_number, 
              r.branch_id, 
              r.customer_id, 
              r.total_amount, 
              r.created_at,
              ri.product_name,
              ri.quantity,
              ri.unit_price,
              ri.total_price
          FROM receipts r
          LEFT JOIN receipt_items ri ON r.id = ri.receipt_id
          WHERE r.customer_id = ?
      `, [customer_id]);
      
      res.status(200).json({
          message: "Rubber transaction data retrieved successfully.",
          data: results
      });
  } catch (error) {
      console.error("Error retrieving rubber transactions for customer:", error);
      res.status(500).json({ error: "Failed to retrieve rubber transactions for customer." });
  }
});


// เริ่มเซิร์ฟเวอร์
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});