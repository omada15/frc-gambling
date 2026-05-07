const LINK = (window.location.href == "localhost:5173") ? "http://localhost:3000" : "https://frc-gambling.vercel.app/";

export async function fetchBetData() {
    const response = await fetch(`${LINK}/bets`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
    });

    const data = await response.json();
    return data;
}

export async function addBet(betID, betChoice, amount) {
    console.log(betID)
    const response = await fetch(`${LINK}/addBet`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({id: betID, choice: betChoice, amount,})
    });
    const data = await response.json();
    return data.playerID;
}