'use strict';
async function supabaseGet(path) {
    const response = await fetch(`${supabaseUrl}${path}`, {
        headers: await supabaseAuthHeaders(),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Error consultando Supabase.");
    }

    return data;
    }