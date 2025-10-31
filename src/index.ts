import express, { Request, Response } from "express";
import Queue from "./queue";
import cors from 'cors';
import fs from "fs";
import https from "https";
const db = require("better-sqlite3")("./database.db");

const key = fs.readFileSync("./fullchain.pem");
const cert = fs.readFileSync("./privkey.pem");

const result = db.exec("CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, content TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, views INTEGER DEFAULT 0, shares INTEGER DEFAULT 0);");


// const query = db.get("SELECT * FROM posts ORDER BY id DESC LIMIT 10;", (err, row) => {
//     if (err) {
//         console.error(err.message);
//         return;
//     }
//     console.log(row);
// });

let demonNames: { [id: string]: string; } = {};

demonNames["Extreme"] = "Extreme Demon";
demonNames["Insane"] = "Insane Demon";
demonNames["Hard"] = "Hard Demon";
demonNames["Medium"] = "Medium Demon";
demonNames["Easy"] = "Easy Demon";
demonNames["Official"] = "Demon";

var faceit_stats: { [id: string]: number } = {
    "kd": 0,
    "hsp": 0,
    "adr": 0,
    "result": 0,
    "elo": 0,
    "level": 0
}

var faceit_name: string = ""

var gd_hardest: { name: string, difficulty: string }[] = [];

const port = 42069
const app = express();
app.enable('trust proxy');

var ips_stats: { [id: string]: Queue<Date> } = {};
var stats_limit: number = 200;

var ips_posts: { [id: string]: Queue<Date> } = {};
var posts_limit: number = 1000;

var ips_interactions: { [id: string]: Queue<Date> } = {};
var posts_interaction_limit: number = 10000;

function get_posts(number: number = 10, from: number = 1) {
    console.log(from - 1)
    const query = db.prepare(`SELECT * FROM posts WHERE id >= ${from} ORDER BY id DESC LIMIT ${number};`).all()
    return query;
}

function get_best_posts(number: number = 10) {
    const query = db.prepare(`SELECT * FROM posts ORDER BY views DESC LIMIT ${number};`).all()
    return query;
}

function get_post(id: number = 1) {
    const query = db.prepare(`SELECT * FROM posts WHERE id == ${id};`).get()
    return query;
}

console.log(get_posts());

async function refreshData() {
    try {
        faceit_stats = {
            "kd": 0,
            "hsp": 0,
            "adr": 0,
            "result": 0,
            "elo": 0,
            "level": 0
        }
        gd_hardest = [];
        let gd_res = await fetch('https://gdladder.com/api/user/29637/submissions?limit=5&page=0&sort=rating&sortDirection=desc')


        let faceit_res = await fetch('https://open.faceit.com/data/v4/players?game=cs2&game_player_id=76561198372860736', {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${process.env.FACEIT_API_KEY}`
            }
        })

        let faceit_stats_res = await fetch('https://open.faceit.com/data/v4/players/4390e418-dbbd-469f-99dd-6ead644006d3/games/cs2/stats', {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${process.env.FACEIT_API_KEY}`
            }
        })

        let gd_response = await gd_res.json();
        let faceit_response = await faceit_res.json();
        let faceit_stats_response = await faceit_stats_res.json()

        gd_response.submissions.forEach((level: any) => {
            gd_hardest.push({ name: level.Level.Meta.Name, difficulty: demonNames[level.Level.Meta.Difficulty] })
        });

        faceit_stats.elo = faceit_response.games.cs2.faceit_elo
        faceit_stats.level = faceit_response.games.cs2.skill_level
        faceit_name = faceit_response.nickname

        faceit_stats_response.items.forEach((match: any) => {
            faceit_stats.adr += Number(match.stats['ADR']);
            faceit_stats.kd += Number(match.stats['K/D Ratio']);
            faceit_stats.hsp += Number(match.stats['Headshots %']);
            faceit_stats.result += Number(match.stats['Result']);
        });
        faceit_stats.adr = Number((faceit_stats.adr / 20).toFixed(2))
        faceit_stats.kd = Number((faceit_stats.kd / 20).toFixed(2))
        faceit_stats.hsp = Number((faceit_stats.hsp / 20).toFixed(2))
        faceit_stats.result = Number((faceit_stats.result / 20).toFixed(2)) * 100
        console.log(faceit_stats.adr)
        console.log(faceit_stats.kd)
        console.log(faceit_stats.hsp)
        console.log(faceit_stats.result)
        console.log(faceit_stats.elo)
        console.log(faceit_name)
        console.log(gd_hardest)
    }
    catch (error) {
        console.error("Error fetching data:", error);
    }
    
}


function handleRateLimiting(req: Request, res: Response, ips: { [id: string]: Queue<Date> }, limit: number): boolean {
    if (req.ip === undefined) {
        res.status(400).send("Could not determine IP");
        return false;
    }

    if (ips[String(req.ip)] === undefined) {
        console.log("New IP detected: " + String(req.ip))
        ips[String(req.ip)] = new Queue<Date>();
    }
    else {
        console.log("Existing IP: " + String(req.ip))
    }

    ips[String(req.ip)].push(new Date());

    console.log(ips[String(req.ip)].peek()?.getTime());
    while (Number(ips[String(req.ip)].peek()?.getTime()) < new Date().getTime() - 300 * 1000) {
        ips[String(req.ip)].pop();
        console.log(ips);
    }

    if (ips[String(req.ip)].length() > limit) {
        res.status(429).send("Too many requests. Please try again later.");
        return false;
    }

    return true;
}

refreshData()
let refreshDataInterval = setInterval(refreshData, 300 * 1000)

app.use(cors({
    origin: '*', // or '*' for public API
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
}));

app.get("/", (req: Request, res: Response) => {
    if (handleRateLimiting(req, res, ips_stats, stats_limit)) {
        res.json({ faceit: JSON.stringify({ name: faceit_name, stats: faceit_stats }), gd: JSON.stringify(gd_hardest) })
    }

})

app.get("/faceit", (req: Request, res: Response) => {
    if (handleRateLimiting(req, res, ips_stats, stats_limit)) {
        res.json({ faceit: JSON.stringify({ name: faceit_name, stats: faceit_stats }) })
    }
})

app.get("/gd", (req: Request, res: Response) => {
    if (handleRateLimiting(req, res, ips_stats, stats_limit)) {
        res.json({ gd: JSON.stringify(gd_hardest) })
    }
})

app.get("/posts", (req: Request, res: Response) => {
    if (handleRateLimiting(req, res, ips_posts, posts_limit)) {
        const posts_list = get_posts(Number(req.query.number) ? Number(req.query.number): undefined, Number(req.query.from) ? Number(req.query.from): undefined);
        res.json({posts: JSON.stringify(posts_list)})
    }
})

app.get("/updateViews", (req: Request, res: Response) => {
    if (handleRateLimiting(req, res, ips_interactions, posts_interaction_limit)) {
        db.prepare(`UPDATE posts SET views = views + 1 WHERE id = ?;`).run(req.query.id);
        res.json()
    }
})

app.get("/updateShares", (req: Request, res: Response) => {
    if (handleRateLimiting(req, res, ips_interactions, posts_interaction_limit)) {
        db.prepare(`UPDATE posts SET shares = shares + 1 WHERE id = ?;`).run(req.query.id);
        res.json()
    }
})

app.get("/post", (req: Request, res: Response) => {
    if (handleRateLimiting(req, res, ips_posts, posts_limit)) {
        if(req.query.number == "about") {
            res.json({post: JSON.stringify({post:{id:1,title:"About",content:"O mnie: lorem ipsum dolor sit amet", created_at:"2025-10-28 18:13:04",views:-1,shares:0}})})
            return;
        }
        const post = get_post(Number(req.query.number) ? Number(req.query.number): undefined);
        res.json({post: JSON.stringify(post)})
    }
})

app.get("/bestposts", (req: Request, res: Response) => {
    if (handleRateLimiting(req, res, ips_posts, posts_limit)) {
        const posts_list = get_best_posts(Number(req.query.number) ? Number(req.query.number): undefined);
        res.json({posts: JSON.stringify(posts_list)})
    }
})

https.createServer({ key, cert }, app).listen(port, () => {
    console.log(`HTTPS server running at https://localhost:${port}`);
});