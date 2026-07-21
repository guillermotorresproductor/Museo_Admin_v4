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


    async function supabasePost(path, body) {
    const response = await fetch(`${supabaseUrl}${path}`, {
        method: "POST",
        headers: await supabaseAuthHeaders(),
        body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Error consultando Supabase.");
    }

    return data;
}

function employeeFromSupabase(row) {
  return {
    id: row.id,
    avatar: employeeInitials({ nombre: row.first_name, apellidos: row.last_name }),
    nombre: row.first_name || "",
    apellidos: row.last_name || "",
    nombreCompleto: `${row.first_name || ""} ${row.last_name || ""}`.trim(),
    foto: row.photo_url || "",
    posicion: row.position || "",
    departamento: row.department || "",
    correo: row.email || "",
    telefono: row.phone || "",
    direccion: row.address || "",
    fechaContratacion: row.hire_date || "",
    horario: row.work_schedule || "",
    educacion: row.education_level || "",
    condicion: row.medical_condition || "",
    usuario: row.email || "",
    passwordTemporal: "",
    acceso: row.access_level ? row.access_level.charAt(0).toUpperCase() + row.access_level.slice(1) : "Empleado",
    estado: row.status === "inactivo" ? "Inactivo" : "Activo",
    notificaciones: "",
    source: "supabase"
  };
}

function employeeToSupabasePayload(employee, museumId) {
  return {
    museum_id: museumId,
    first_name: employee.nombre,
    last_name: employee.apellidos,
    photo_url: employee.foto || null,
    position: employee.posicion,
    department: employee.departamento,
    email: employee.correo,
    phone: employee.telefono || null,
    address: employee.direccion || null,
    hire_date: employee.fechaContratacion || null,
    work_schedule: employee.horario || null,
    education_level: employee.educacion || null,
    medical_condition: employee.condicion || null,
    access_level: (employee.acceso || "Empleado").toLowerCase(),
    status: employee.estado === "Inactivo" ? "inactivo" : "activo"
  };
}

async function fetchSupabaseEmployees() {
  const data = await supabaseGet("/rest/v1/employees?select=*&order=created_at.asc");
  return data.map(employeeFromSupabase);
}
async function saveSupabaseEmployee(employee, museumId, id) {
  const payload = employeeToSupabasePayload(employee, museumId);
  const isSupabaseId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const path = isSupabaseId
    ? `/rest/v1/employees?id=eq.${encodeURIComponent(id)}`
    : "/rest/v1/employees";
  const response = await fetch(`${supabaseUrl}${path}`, {
    method: isSupabaseId ? "PATCH" : "POST",
    headers: {
      ...(await supabaseAuthHeaders()),
      Prefer: "return=representation"
    },
    body: JSON.stringify(payload)
  });
  const saved = await response.json();
  if (!response.ok) throw new Error(saved.message || "No se pudo guardar el empleado en Supabase.");
  return saved;
}

async function updateSupabaseEmployee(id, employee, museumId) {
  const payload = employeeToSupabasePayload(employee, museumId);
  const response = await fetch(`${supabaseUrl}/rest/v1/employees?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: await supabaseAuthHeaders(),
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.message || "No se pudo actualizar Supabase.");
  }
}