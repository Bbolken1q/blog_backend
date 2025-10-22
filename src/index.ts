import express, { Request, Response } from "express";

let demonNames: { [id: string ] : string; } = {};

demonNames["Extreme"] = "Extreme Demon";
demonNames["Insane"] = "Insane Demon";
demonNames["Hard"] = "Hard Demon";
demonNames["Medium"] = "Medium Demon";
demonNames["Easy"] = "Easy Demon";
demonNames["Official"] = "Demon";

let faceit_stats: {[id:string]: number} = {
    "kd": 0,
    "hsp": 0,
    "adr": 0,
    "result": 0,
    "elo": 0
}

let faceit_name: string = ""

let gd_hardest: {name: string, difficulty: string}[] = [];

const port = 3000;
const app = express();
app.enable('trust proxy');

async function refreshData() {
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

    // console.log(gd_response.submissions[0].Level.Meta.Name)
    // console.log(demonNames[gd_response.submissions[0].Level.Meta.Difficulty])
    // console.log(gd_response.submissions[1].Level.Meta.Name)
    // console.log(demonNames[gd_response.submissions[1].Level.Meta.Difficulty])
    // console.log(gd_response.submissions[2].Level.Meta.Name)
    // console.log(demonNames[gd_response.submissions[2].Level.Meta.Difficulty])
    // console.log(gd_response.submissions[3].Level.Meta.Name)
    // console.log(demonNames[gd_response.submissions[3].Level.Meta.Difficulty])
    // console.log(gd_response.submissions[4].Level.Meta.Name)
    // console.log(demonNames[gd_response.submissions[4].Level.Meta.Difficulty])

    gd_response.submissions.forEach((level: any) => {
        gd_hardest.push({name: level.Level.Meta.Name, difficulty: demonNames[level.Level.Meta.Difficulty]})
    });
    
    faceit_stats.elo = faceit_response.games.cs2.faceit_elo
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


refreshData()
// let refreshDataInterval = setInterval(refreshData, 300*1000)

app.get("/", (req: Request, res: Response) => {
    console.log(req)
    res.json({message: "zwrot"})
})

app.get("/faceit", (req: Request, res: Response) => {
    console.log(req.ip)
    res.json({message: "zwrot2"})
})

app.get("/gd", (req: Request, res: Response) => {
    console.log(req.ip)
    res.json({message: "zwrot2"})
})

app.listen(port, () => {
    console.log(`The server is running at http://localhost:${port}`)
})