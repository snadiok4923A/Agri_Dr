import { supabase } from "./supabaseClient";

export const EXPENSE_CATEGORIES = [
    { value: "land_preparation", label: "Land preparation / ploughing" },
    { value: "seeds", label: "Seeds" },
    { value: "seed_treatment", label: "Seed treatment" },
    { value: "fertilizers", label: "Fertilizers" },
    { value: "pesticides", label: "Pesticides / medicines" },
    { value: "labour", label: "Labour costs" },
    { value: "irrigation", label: "Irrigation" },
    { value: "machinery", label: "Machinery / equipment rental" },
    { value: "harvesting", label: "Harvesting" },
    { value: "transportation", label: "Transportation" },
    { value: "other", label: "Other expenses" },
];

const schemaMessage =
    "Financial records are not available yet. Ask an administrator to apply the finance migration.";

function throwDatabaseError(error) {
    if (error) {
        const message = String(error.message || error);
        if (/schema cache|relation .* does not exist|could not find the table/i.test(message)) {
            throw new Error(schemaMessage);
        }
        throw new Error(message);
    }
}

export async function fetchFinancialRecords(userId) {
    if (!userId) throw new Error("You must be signed in to manage financial records.");
    const [expensesResult, targetsResult] = await Promise.all([
        supabase
            .from("farm_expenses")
            .select("id, parcel_id, category, amount, description, expense_date")
            .eq("user_id", userId)
            .order("expense_date", { ascending: false }),
        supabase
            .from("farm_financial_targets")
            .select(
                "id, parcel_id, expected_production_kg, expected_price_per_quintal, expected_selling_date",
            )
            .eq("user_id", userId),
    ]);
    throwDatabaseError(expensesResult.error);
    throwDatabaseError(targetsResult.error);
    return {
        expenses: (expensesResult.data || []).map((row) => ({
            id: row.id,
            parcelId: row.parcel_id,
            category: row.category,
            amount: Number(row.amount),
            description: row.description || "",
            date: row.expense_date,
        })),
        targets: (targetsResult.data || []).map((row) => ({
            id: row.id,
            parcelId: row.parcel_id,
            productionKg: Number(row.expected_production_kg),
            pricePerQuintal: Number(row.expected_price_per_quintal),
            sellingDate: row.expected_selling_date || "",
        })),
    };
}

export async function saveFinancialRecords(userId, { expenses, targets }) {
    if (!userId) throw new Error("You must be signed in to manage financial records.");
    const current = await fetchFinancialRecords(userId);
    const expenseRows = expenses.map((entry) => ({
        ...(entry.id ? { id: entry.id } : {}),
        user_id: userId,
        parcel_id: entry.parcelId,
        category: entry.category,
        amount: Number(entry.amount),
        description: entry.description?.trim() || null,
        expense_date: entry.date,
    }));
    const targetRows = targets.map((target) => ({
        ...(target.id ? { id: target.id } : {}),
        user_id: userId,
        parcel_id: target.parcelId,
        expected_production_kg: Number(target.productionKg),
        expected_price_per_quintal: Number(target.pricePerQuintal),
        expected_selling_date: target.sellingDate || null,
    }));

    const expenseIdsToDelete = current.expenses
        .map((entry) => entry.id)
        .filter((id) => !expenseRows.some((entry) => entry.id === id));
    if (expenseIdsToDelete.length) {
        const { error } = await supabase
            .from("farm_expenses")
            .delete()
            .eq("user_id", userId)
            .in("id", expenseIdsToDelete);
        throwDatabaseError(error);
    }
    const targetIdsToDelete = current.targets
        .map((target) => target.id)
        .filter((id) => !targetRows.some((target) => target.id === id));
    if (targetIdsToDelete.length) {
        const { error } = await supabase
            .from("farm_financial_targets")
            .delete()
            .eq("user_id", userId)
            .in("id", targetIdsToDelete);
        throwDatabaseError(error);
    }

    if (expenseRows.length) {
        const { error } = await supabase.from("farm_expenses").upsert(expenseRows);
        throwDatabaseError(error);
    }
    if (targetRows.length) {
        const { error } = await supabase
            .from("farm_financial_targets")
            .upsert(targetRows, { onConflict: "user_id,parcel_id" });
        throwDatabaseError(error);
    }
    return fetchFinancialRecords(userId);
}
