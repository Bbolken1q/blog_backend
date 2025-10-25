import express, { Request, Response } from "express";
import Queue from "./queue";
import cors from 'cors';


let demonNames: { [id: string ] : string; } = {};

demonNames["Extreme"] = "Extreme Demon";
demonNames["Insane"] = "Insane Demon";
demonNames["Hard"] = "Hard Demon";
demonNames["Medium"] = "Medium Demon";
demonNames["Easy"] = "Easy Demon";
demonNames["Official"] = "Demon";

var faceit_stats: {[id:string]: number} = {
    "kd": 0,
    "hsp": 0,
    "adr": 0,
    "result": 0,
    "elo": 0,
    "level": 0
}

var faceit_name: string = ""

var gd_hardest: {name: string, difficulty: string}[] = [];

const port = 42069
const app = express();
app.enable('trust proxy');

var ips: {[id: string] : Queue<Date>} = {};

async function refreshData() {

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
        gd_hardest.push({name: level.Level.Meta.Name, difficulty: demonNames[level.Level.Meta.Difficulty]})
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
    faceit_stats.result = Number((faceit_stats.result / 20).toFixed(2))* 100
    console.log(faceit_stats.adr)
    console.log(faceit_stats.kd)
    console.log(faceit_stats.hsp)
    console.log(faceit_stats.result)
    console.log(faceit_stats.elo)
    console.log(faceit_name)
    console.log(gd_hardest)
}


function handleRateLimiting(req: Request, res: Response): boolean {
    if (req.ip === undefined) {
        res.status(400).send("Could not determine IP");
        return false;
    }

    if(ips[String(req.ip)] === undefined) {
        console.log("New IP detected: " + String(req.ip))
        ips[String(req.ip)] = new Queue<Date>();
    }
    else {
        console.log("Existing IP: " + String(req.ip))
    }

    ips[String(req.ip)].push(new Date());

    console.log(ips[String(req.ip)].peek()?.getTime());
    while(Number(ips[String(req.ip)].peek()?.getTime()) < new Date().getTime() - 300*1000) {
        ips[String(req.ip)].pop();
        console.log(ips);
    }

    if(ips[String(req.ip)].length() > 200) {
        res.status(429).send("Too many requests. Please try again later.");
        return false;
    }

    return true;
}

refreshData()
let refreshDataInterval = setInterval(refreshData, 300*1000)

app.use(cors({
  origin: 'http://balls.monster:2052/', // or '*' for public API
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));

app.get("/", (req: Request, res: Response) => {
    if(handleRateLimiting(req, res)) {
        res.json({faceit: JSON.stringify({name: faceit_name, stats: faceit_stats}), gd: JSON.stringify(gd_hardest)})
    }
    
})

app.get("/faceit", (req: Request, res: Response) => {
    if(handleRateLimiting(req, res)) {
        res.json({faceit: JSON.stringify({name: faceit_name, stats: faceit_stats})})
}
})

app.get("/gd", (req: Request, res: Response) => {
    if(handleRateLimiting(req, res)) {
        res.json({gd: JSON.stringify(gd_hardest)})
    }
})

app.listen(port, () => {
    console.log(`The server is running at http://localhost:${port}`)
})