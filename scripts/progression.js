"use strict";

function getLastEntry(log, exerciseId) {
    const entries = log.filter(entry => entry.exercise === exerciseId);

    if (entries.length === 0) {
        return null;
    }

    return entries.sort((a, b) =>
        a.date.localeCompare(b.date)
    )[entries.length - 1];
}

function loadValue(set) {
    return typeof set.weight === "number" ? set.weight : 0;
}

function getTopSet(entry) {
    if (!entry || !Array.isArray(entry.sets)) {
        return null;
    }

    return entry.sets.reduce((best, current) => {
        if (!best) {
            return current;
        }

        if (loadValue(current) > loadValue(best)) {
            return current;
        }

        if (
            loadValue(current) === loadValue(best) &&
            current.reps > best.reps
        ) {
            return current;
        }

        return best;
    }, null);
}

function isBodyweight(exercise) {
    return (
        exercise.equipment === "bodyweight" &&
        exercise.load !== "bodyweight_plus"
    );
}

function formatAmount(exercise, amount) {
    if (exercise.metric === "seconds") {
        return `${amount} sec`;
    }

    if (exercise.metric === "minutes") {
        return `${amount} min`;
    }

    return `${amount} reps`;
}

function formatLoad(exercise, weight) {
    if (isBodyweight(exercise)) {
        return weight ? `Bodyweight + ${weight} lb` : "Bodyweight";
    }

    if (exercise.load === "per_side") {
        return `${weight} lb per side`;
    }

    if (exercise.load === "per_hand") {
        return `${weight} lb each`;
    }

    return `${weight} lb`;
}

function formatGoal(exercise, weight, amount) {
    return `${formatLoad(exercise, weight)} × ${formatAmount(exercise, amount)}`;
}

function getNextGoal(program, exerciseId, target) {
    const exercise = program.exercises[exerciseId];

    if (!exercise) {
        return {
            action: "unknown_exercise",
            label: `Exercise "${exerciseId}" is not defined`
        };
    }

    const entry = getLastEntry(program.log, exerciseId);
    const topSet = getTopSet(entry);

    if (!topSet) {
        if (isBodyweight(exercise)) {
            return {
                action: "establish_baseline",
                weight: null,
                reps: target.min,
                label: `Work up to ${formatAmount(exercise, target.min)}`
            };
        }

        return {
            action: "establish_baseline",
            weight: null,
            reps: target.min,
            label: `Find a working weight for ${formatAmount(exercise, `${target.min}-${target.max}`)}`
        };
    }

    const weight = loadValue(topSet);

    if (isBodyweight(exercise)) {
        return {
            action: "add_rep",
            weight: topSet.weight,
            reps: topSet.reps + 1,
            label: formatGoal(exercise, topSet.weight, topSet.reps + 1)
        };
    }

    const step =
        program.progression.increments[exercise.equipment] ??
        program.progression.increments.default;

    if (topSet.reps >= target.max) {
        return {
            action: "increase_weight",
            weight: weight + step,
            reps: target.min,
            label: formatGoal(exercise, weight + step, target.min)
        };
    }

    if (topSet.reps < target.min) {
        const reduced = Math.max(0, weight - step);

        return {
            action: "reduce_weight",
            weight: reduced,
            reps: target.min,
            label: formatGoal(exercise, reduced, target.min)
        };
    }

    return {
        action: "add_rep",
        weight: weight,
        reps: topSet.reps + 1,
        label: formatGoal(exercise, weight, topSet.reps + 1)
    };
}

window.Progression = {
    getLastEntry,
    getTopSet,
    getNextGoal
};
