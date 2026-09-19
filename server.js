import express from "express"
import pool from "./db.js"
import cors from "cors"
import dotenv from "dotenv"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"


dotenv.config()

const app = express()



const port = process.env.PORT || 3000

app.use(express.json())
app.use(cors())


const authMiddleware = (req, res, next) => {

    const authHeader = req.headers.authorization

    if(!authHeader) {

        return res.status(401).json({
            error: "TOKEN REQUIRED"
        })
    }

    const token = authHeader.split(" ")[1]

    try {

        const decoded = jwt.verify(token,process.env.JWT_SECRET)

        req.user =  decoded

        next()
    } catch (err) {
        return  res.status(401).json({
            error: "INVALID TOKEN"
        })
    }





}


app.get("/",  authMiddleware, (req, res) => {
    res.send("MOTHERFUCK")
})


app.get("/users",  authMiddleware, async (req, res) => {

    let conn

    try {

        conn = await pool.getConnection()
    
         const rows = await conn.query("SELECT * FROM users")

         res.json(rows)



    } catch (err) {

        console.error(err)

        res.status(500).json( { error: "ERROR for found users"})
    } finally {

        if (conn) conn.release()
    }

    
})


app.get("/users/:id",  authMiddleware, async (req, res) => {

    let conn 

    try {
        conn = await pool.getConnection()

        const rows = await conn.query("SELECT * FROM users WHERE id = ?",[req.params.id])


        if(rows.length === 0){

            return res.status(404).json({ error: 'USER NOT FOUND '})
        }

        res.json(rows[0])
    } catch (err) {

        console.error(err)

        res.status(500).json({ error: "SERVER ERROR" })
    } finally {

        if (conn) conn.release()
    }
})

app.post("/users", async (req, res) => {

    let conn


    try {

        conn = await pool.getConnection()

        const { name, email, password } = req.body

        const hashedPassword = await bcrypt.hash(password, 10)

        const result = await conn.query(
            "INSERT INTO users (name, email, password) VALUES (?, ?, ?)", [name, email, hashedPassword]
        )
        
          

        res.status(201).json(
            {
                id: result.insertId,
                name,
                email
            }
        )
    } catch (err) {
        console.error(err)

        if(err.code === "ER_DUP_ENTRY") {

            return res.status(409).json({ error: "Email was registried"})
        }

        res.status(500).json( { error: "SERVER ERROR"})
    } finally {
        if (conn) conn.release()
    }
})


app.put("/users/:id",  authMiddleware, async (req, res) => {

    let conn

    try {

        conn = await pool.getConnection()

        const { name, email } = req.body

        const result = await conn.query(
            "UPDATE users SET name = ?, email = ? WHERE id = ?",[name, email, req.params.id]
        )

        if(result.affectedRows === 0) {

            return res.status(404).json({
                error: "USER NOT FOUND"
            })
        }

        res.json(
            {
                id: req.params.id,
                name,
                email
            }
        )
    } catch (err) {

        console.error(err)

        if (err.code === "ER_DUP_ENTRY"){

            return res.status(409).json(
                {
                    error: "data already exists"
                }
            )
        }
    } finally {
        if (conn) conn.release()
    }
})


app.delete("/users/:id",  authMiddleware, async (req, res) => {

    let conn

    try {

        conn = await pool.getConnection()

        const result = await conn.query(
            "DELETE FROM users WHERE id = ?",[req.params.id]
        )

        if(result.affectedRows === 0){

            return res.status(404).json({
                error: "USER NOT FOUND"
            })
        }

        res.json({
            message: "USER DELETED"
        })
    } catch (err) {

        console.error(err)

        res.status(500).json({
            error: "SERVER ERROR"
        })
    } finally {

        if (conn) conn.release()
    }
})

app.post("/auth/login", async (req, res) => {

    let conn

    try {

        conn =  await pool.getConnection()

        const { email, password } = req.body

        const rows = await conn.query(
            "SELECT * FROM users WHERE email = ?", [email]
        )

        if(rows.length === 0){

            return res.status(401).json({
                error: "INVALID EMAIL OR PASSWORD"
            })
        }

        const user = rows[0]

        const passwordCorrect = await bcrypt.compare(password, user.password)

        if(!passwordCorrect){

            return res.status(401).json({
                error: "INVALID EMAIL OR PASSWORD"
            })
        }

        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                name: user.name
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1h"
            }
        )

        res.json({
             message: "LOGIN SUCESS", token
    })


    } catch  (err) {

        console.error(err)

        res.status(500).json({
            error: "SERVER ERROR"
        })

    } finally {
        if (conn) conn.release()
    }
})

app.listen(port, () => {

    console.log(`Server running on http://localhost:${port}`)
    //console.log(process.env.DB_USER)
})
