import express from "express";

const app = express();
app.use(express.json());
const router = express.Router();

app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET,POST,PUT,DELETE,OPTIONS",
    );
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization",
    );

    // Handle the preflight request
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }
    next();
});
app.use(express.static("./frontend/dist"));
// var betChoices = [];
// var bets = [];

var betChoices = [
    {
        title: "yes or no",
        options: ["yes", "no"],
        winner: null,
    },
];
var bets = [
    [
        { choiceIndex: 0, amount: 16 },
        { choiceIndex: 1, amount: 15 },
    ],
];

var totals = new Array(betChoices.length).fill(0);
var mults = new Array(betChoices.length).fill(0);
var totalPool = 0;

function calc(betId) {
    totals = new Array(betChoices[betId].options.length).fill(0);
    mults = new Array(betChoices[betId].options.length).fill(0);
    bets[betId].forEach((p) => {
        totals[p.choiceIndex] += p.amount;
    });
    totalPool = totals.reduce((sum, val) => sum + val, 0);

    for (let i = 0; i < betChoices[betId].options.length; i++) {
        if (totals[i] > 0) {
            mults[i] = totalPool / totals[i];
        }
    }
    // betChoices.forEach((choices, j) => {
    //     choices.options.forEach((name, i) => {
    //         console.log(`"${name}" has multiplier of ${mults[i].toFixed(2)}x`);
    //     });
    // });
}
function playerData(playerIndex, betId) {
    const p = bets[betId][playerIndex];
    const winout = p.amount * mults[p.choiceIndex];

    // console.log(`\nPlayer ${playerIndex + 1} stats (id ${playerIndex}):`);
    // console.log(`Player chose "${betChoices[betId].options[p.choiceIndex]}"`);
    // console.log(`Invested: ${p.amount}`);
    // console.log(`Return: ${winout.toFixed(2)}`);
    // console.log(`Profit: ${(winout - p.amount).toFixed(2)}`);
    // console.log(
    //     `Percent: ${(((winout - p.amount) * 100) / p.amount).toFixed(2)}%`,
    // );
    var josn = {
        invested: p.amount,
        return: winout.toFixed(2),
        profit: (winout - p.amount).toFixed(2),
        percent: (((winout - p.amount) * 100) / p.amount).toFixed(2),
    };
    return josn;
}

function addBet(id, choice, amount) {
    if (betChoices[id].winner == null) {
        bets[id].push({ choiceIndex: choice, amount: amount });
        calc(id);
        return bets[id].length - 1;
    } else {
        return -1;
    }
}

function newBet(title, choices) {
    betChoices.push({ title, options: choices });
    bets.push([]);
}

router.post("/addBet", (req, res) => {
    console.log(req.body);
    res.send({
        playerID: addBet(req.body.id, req.body.choice, req.body.amount),
    });
    console.log(bets);
});
router.post("/finishBet", (req, res) => {
    console.log(req.body);
    betChoices[req.body.id].winner = req.body.winner;
    res.send({ message: "recieved" });
});
router.get("/bets", (req, res) => {
    var retur = [];
    betChoices.forEach((p, i) => {
        calc(i);
        retur.push({ data: p, mults: mults, totals });
    });
    res.json(retur);
});

app.use(router);

calc(0);

app.listen(3000, (req, res) => {
    console.log(`server on 3000`);
});
