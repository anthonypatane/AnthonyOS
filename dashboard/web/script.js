// ==============================
// Anthony OS Clock
// ==============================

function updateClock() {

    const now = new Date();

    const time = now.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
    });

    const date = now.toLocaleDateString([], {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
    });

    document.getElementById("clock").textContent = time;

    document.getElementById("date").textContent = date;

}

updateClock();

setInterval(updateClock, 1000);