document.addEventListener("DOMContentLoaded", iniciarPagina);

const URL_APPS_SCRIPT =
    "https://script.google.com/a/macros/ucb.edu.bo/s/AKfycbxWvtE5rypVJosF_IbvOhSh3y9mG7YP5yXLDGr9D2Nys2YAqScx3hPBajvW2Tj9jDoeKA/exec";

// Estado de la búsqueda y de la confirmación.
let ultimaConsulta = "";
let participantePendiente = null;
let tipoAccionPendiente = null;
let solicitudEnCurso = false;

// ========================================
// INICIALIZACIÓN
// ========================================

function iniciarPagina() {
    configurarNavegacion();
    configurarBusqueda();
    configurarFormulario();
    configurarCamara();
    configurarModalConfirmacion();
}

// ========================================
// CAMBIO ENTRE LAS TRES SECCIONES
// ========================================

function configurarNavegacion() {
    const botones = document.querySelectorAll(".nav-boton");
    const secciones = document.querySelectorAll(".seccion");

    botones.forEach((boton) => {
        boton.addEventListener("click", () => {
            const destino = boton.dataset.seccion;

            botones.forEach((otroBoton) => {
                const seleccionado = otroBoton === boton;

                otroBoton.classList.toggle("activo", seleccionado);
                otroBoton.setAttribute(
                    "aria-selected",
                    String(seleccionado)
                );
            });

            secciones.forEach((seccion) => {
                const mostrar = seccion.id === `seccion-${destino}`;

                seccion.hidden = !mostrar;
                seccion.classList.toggle("activa", mostrar);
            });

            if (destino !== "camara") {
                detenerCamara();
            }
        });
    });
}

// ========================================
// BÚSQUEDA DE PARTICIPANTES
// ========================================

function configurarBusqueda() {
    const formulario = document.getElementById("form-busqueda");
    const campo = document.getElementById("busqueda");
    const resultado = document.getElementById("resultado-busqueda");

    if (!formulario || !campo || !resultado) {
        console.error("No se encontraron los elementos del buscador.");
        return;
    }

    formulario.addEventListener("submit", async (evento) => {
        evento.preventDefault();

        const consulta = campo.value.trim();

        if (!consulta) {
            campo.focus();
            mostrarMensajeBusqueda(
                resultado,
                "Escribe un nombre, institución o celular."
            );
            return;
        }

        const botonEnviar = formulario.querySelector(
            'button[type="submit"], input[type="submit"]'
        );

        if (botonEnviar) {
            botonEnviar.disabled = true;
        }

        ultimaConsulta = consulta;
        mostrarMensajeBusqueda(resultado, "Buscando participantes...");

        try {
            await ejecutarBusqueda(consulta);
        } catch (error) {
            console.error("Error al buscar participantes:", error);

            mostrarMensajeBusqueda(
                resultado,
                "No se pudo conectar con Google Sheets. Comprueba tu sesión institucional de la UCB e inténtalo nuevamente."
            );
        } finally {
            if (botonEnviar) {
                botonEnviar.disabled = false;
            }
        }
    });
}

async function ejecutarBusqueda(consulta) {
    const resultado = document.getElementById("resultado-busqueda");
    const respuesta = await consultarParticipantes(consulta);

    if (!respuesta || respuesta.ok !== true) {
        throw new Error(
            respuesta?.mensaje || "No se pudo completar la búsqueda."
        );
    }

    mostrarResultados(resultado, respuesta.participantes || []);
}

// ========================================
// COMUNICACIÓN CON APPS SCRIPT MEDIANTE JSONP
// ========================================

function solicitarAppsScript(parametrosBase) {
    return new Promise((resolve, reject) => {
        const nombreCallback =
            "fintechCallback_" +
            Date.now() +
            "_" +
            Math.floor(Math.random() * 1000000);

        const script = document.createElement("script");

        const parametros = new URLSearchParams({
            ...parametrosBase,
            callback: nombreCallback
        });

        let finalizado = false;

        const limpiar = () => {
            clearTimeout(temporizador);
            script.remove();
            delete window[nombreCallback];
        };

        const temporizador = setTimeout(() => {
            if (finalizado) return;

            finalizado = true;
            limpiar();

            reject(
                new Error(
                    "La solicitud tardó demasiado. Comprueba tu conexión y tu sesión institucional."
                )
            );
        }, 20000);

        window[nombreCallback] = (respuesta) => {
            if (finalizado) return;

            finalizado = true;
            limpiar();
            resolve(respuesta);
        };

        script.onerror = () => {
            if (finalizado) return;

            finalizado = true;
            limpiar();

            reject(
                new Error(
                    "No se pudo cargar la respuesta de Apps Script."
                )
            );
        };

        script.src =
            URL_APPS_SCRIPT + "?" + parametros.toString();

        document.head.appendChild(script);
    });
}

function consultarParticipantes(consulta) {
    return solicitarAppsScript({
        accion: "buscar",
        consulta: consulta
    });
}

// ========================================
// MOSTRAR RESULTADOS
// ========================================

function mostrarMensajeBusqueda(contenedor, mensaje) {
    contenedor.replaceChildren();

    const texto = document.createElement("p");
    texto.className = "mensaje-titulo";
    texto.textContent = mensaje;

    contenedor.appendChild(texto);
}

function obtenerTipoAccion(persona) {
    const estado = String(persona.estadoAsistencia || "")
        .trim()
        .toLowerCase();

    if (
        estado === "salió" ||
        estado === "salio" ||
        persona.fechaSalida
    ) {
        return "completa";
    }

    if (
        estado === "ingresó" ||
        estado === "ingreso" ||
        estado === "ingresó" ||
        estado === "ingreso registrado" ||
        persona.fechaIngreso
    ) {
        return "registrarSalida";
    }

    return "registrarEntrada";
}

function mostrarResultados(contenedor, participantes) {
    contenedor.replaceChildren();

    if (!participantes.length) {
        mostrarMensajeBusqueda(
            contenedor,
            "No se encontraron participantes con esos datos."
        );
        return;
    }

    const titulo = document.createElement("p");
    titulo.className = "mensaje-titulo";
    titulo.textContent =
        participantes.length === 1
            ? "Se encontró 1 participante"
            : `Se encontraron ${participantes.length} participantes`;

    contenedor.appendChild(titulo);

    participantes.forEach((persona) => {
        const tarjeta = document.createElement("article");
        tarjeta.className = "resultado-participante";

        const nombre = document.createElement("h3");
        nombre.textContent = persona.nombre || "Sin nombre";

        const institucion = document.createElement("p");
        institucion.textContent =
            "Institución: " +
            (persona.institucion || "No registrada");

        const asistencia = document.createElement("p");
        asistencia.textContent =
            "Asistencia: " +
            (persona.estadoAsistencia || "Pendiente de ingreso");

        const ingreso = document.createElement("p");
        ingreso.textContent = persona.fechaIngreso
            ? "Hora de ingreso: " + persona.fechaIngreso
            : "Hora de ingreso: Pendiente de ingreso";

        const botonAccion = document.createElement("button");
        botonAccion.type = "button";
        botonAccion.className = "boton boton-principal";

        const tipoAccion = obtenerTipoAccion(persona);

        if (tipoAccion === "registrarEntrada") {
            botonAccion.textContent = "REGISTRAR ENTRADA";
        } else if (tipoAccion === "registrarSalida") {
            botonAccion.textContent = "REGISTRAR SALIDA";
        } else {
            botonAccion.textContent = "ASISTENCIA COMPLETA";
            botonAccion.disabled = true;
        }

        botonAccion.addEventListener("click", () => {
            abrirConfirmacion(persona, tipoAccion);
        });

        tarjeta.append(
            nombre,
            institucion,
            asistencia,
            ingreso,
            botonAccion
        );

        contenedor.appendChild(tarjeta);
    });
}

// ========================================
// MODAL DE CONFIRMACIÓN
// ========================================

function configurarModalConfirmacion() {
    const modal = document.getElementById("modal-confirmacion");
    const botonCancelar = document.getElementById(
        "btn-cancelar-confirmacion"
    );
    const botonConfirmar = document.getElementById(
        "btn-confirmar-accion"
    );
    const fondo = modal?.querySelector(".modal-confirmacion-fondo");

    if (!modal || !botonCancelar || !botonConfirmar) {
        console.error(
            "Faltan elementos del modal de confirmación. Revisa el HTML."
        );
        return;
    }

    botonCancelar.addEventListener("click", cerrarConfirmacion);
    botonConfirmar.addEventListener("click", confirmarAccion);

    if (fondo) {
        fondo.addEventListener("click", cerrarConfirmacion);
    }

    document.addEventListener("keydown", (evento) => {
        if (
            evento.key === "Escape" &&
            modal.classList.contains("visible") &&
            !solicitudEnCurso
        ) {
            cerrarConfirmacion();
        }
    });
}

function abrirConfirmacion(persona, tipoAccion) {
    if (tipoAccion === "completa") {
        return;
    }

    if (!persona || !persona.id) {
        alert(
            "No se pudo identificar el ID del participante. No se realizará ningún cambio."
        );
        return;
    }

    participantePendiente = persona;
    tipoAccionPendiente = tipoAccion;

    const modal = document.getElementById("modal-confirmacion");
    const nombre = document.getElementById("confirmacion-nombre");
    const institucion = document.getElementById(
        "confirmacion-institucion"
    );
    const accion = document.getElementById("confirmacion-accion");
    const descripcion = document.getElementById(
        "descripcion-confirmacion"
    );
    const mensaje = document.getElementById("mensaje-confirmacion");
    const icono = document.getElementById("icono-confirmacion");
    const botonConfirmar = document.getElementById(
        "btn-confirmar-accion"
    );
    const botonCancelar = document.getElementById(
        "btn-cancelar-confirmacion"
    );

    if (
        !modal ||
        !nombre ||
        !institucion ||
        !accion ||
        !descripcion ||
        !mensaje ||
        !botonConfirmar ||
        !botonCancelar
    ) {
        console.error("Faltan elementos dentro del modal.");
        return;
    }

    nombre.textContent = persona.nombre || "Sin nombre";
    institucion.textContent =
        persona.institucion || "Institución no registrada";

    if (tipoAccion === "registrarEntrada") {
        accion.textContent = "Registrar entrada";
        descripcion.textContent =
            "Vas a registrar el ingreso de este participante al evento.";
        botonConfirmar.textContent = "CONFIRMAR ENTRADA";
    } else {
        accion.textContent = "Registrar salida";
        descripcion.textContent =
            "Vas a registrar la salida de este participante del evento.";
        botonConfirmar.textContent = "CONFIRMAR SALIDA";
    }

    if (icono) {
        icono.textContent = "?";
    }

    mensaje.textContent = "";
    botonConfirmar.disabled = false;
    botonCancelar.disabled = false;
    botonCancelar.textContent = "CANCELAR";

    modal.classList.add("visible");
    modal.setAttribute("aria-hidden", "false");
}

function cerrarConfirmacion() {
    if (solicitudEnCurso) {
        return;
    }

    const modal = document.getElementById("modal-confirmacion");

    if (modal) {
        modal.classList.remove("visible");
        modal.setAttribute("aria-hidden", "true");
    }

    participantePendiente = null;
    tipoAccionPendiente = null;
}

// ========================================
// REGISTRAR ENTRADA O SALIDA
// ========================================

async function confirmarAccion() {
    if (
        solicitudEnCurso ||
        !participantePendiente ||
        !tipoAccionPendiente
    ) {
        return;
    }

    const botonConfirmar = document.getElementById(
        "btn-confirmar-accion"
    );
    const botonCancelar = document.getElementById(
        "btn-cancelar-confirmacion"
    );
    const mensaje = document.getElementById("mensaje-confirmacion");

    if (!botonConfirmar || !mensaje) {
        return;
    }

    solicitudEnCurso = true;
    botonConfirmar.disabled = true;

    if (botonCancelar) {
        botonCancelar.disabled = true;
    }

    botonConfirmar.textContent = "PROCESANDO...";
    mensaje.textContent = "Registrando la asistencia. Espera un momento.";

    try {
        const respuesta = await solicitarAppsScript({
            accion: tipoAccionPendiente,
            id: participantePendiente.id
        });

        if (!respuesta || respuesta.ok !== true) {
            throw new Error(
                respuesta?.mensaje ||
                "No se pudo registrar la asistencia."
            );
        }

        mensaje.textContent =
            respuesta.mensaje ||
            "La asistencia se registró correctamente.";

        botonConfirmar.textContent = "REGISTRADO";

        const icono = document.getElementById("icono-confirmacion");

        if (icono) {
            icono.textContent = "✓";
        }

        // Actualiza los resultados consultando nuevamente la hoja.
        // El modal permanece abierto para que el organizador lea el resultado.
        try {
            if (ultimaConsulta) {
                await ejecutarBusqueda(ultimaConsulta);
            }
        } catch (errorBusqueda) {
            console.warn(
                "El registro se completó, pero no se pudo actualizar la búsqueda:",
                errorBusqueda
            );
        }

    } catch (error) {
        console.error("Error al registrar asistencia:", error);

        mensaje.textContent =
            error.message ||
            "Ocurrió un error al registrar la asistencia.";

        botonConfirmar.disabled = false;

        if (tipoAccionPendiente === "registrarEntrada") {
            botonConfirmar.textContent = "REINTENTAR ENTRADA";
        } else {
            botonConfirmar.textContent = "REINTENTAR SALIDA";
        }
    } finally {
        solicitudEnCurso = false;

        if (botonCancelar) {
            botonCancelar.disabled = false;
            botonCancelar.textContent = "CERRAR";
        }
    }
}

// ========================================
// FORMULARIO DE NUEVO REGISTRO
// Todavía no guarda en Google Sheets.
// ========================================

function configurarFormulario() {
    const formulario = document.getElementById("form-nuevo-registro");
    const mensaje = document.getElementById("mensaje-registro");

    if (!formulario || !mensaje) {
        console.warn("No se encontraron los elementos del formulario.");
        return;
    }

    formulario.addEventListener("submit", (evento) => {
        evento.preventDefault();

        if (!formulario.reportValidity()) {
            return;
        }

        mensaje.textContent =
            "Formulario preparado. La conexión para guardar los datos se implementará en la siguiente etapa.";
    });

    formulario.addEventListener("input", () => {
        mensaje.textContent = "";
    });
}


// =========================================
// CÁMARA Y LECTOR QR
// =========================================

let lectorQR = null;
let qrDetectado = false;

function configurarCamara() {
    const botonActivar = document.getElementById("btn-activar-camara");
    const botonDetener = document.getElementById("btn-detener-camara");

    if (botonActivar) {
        botonActivar.addEventListener("click", activarCamara);
    }

    if (botonDetener) {
        botonDetener.addEventListener("click", detenerCamara);
    }
}

async function activarCamara() {
    const mensaje = document.getElementById("mensaje-camara");
    const estado = document.getElementById("estado-camara");
    const botonActivar = document.getElementById("btn-activar-camara");
    const botonDetener = document.getElementById("btn-detener-camara");
    const marco = document.querySelector(".marco-escaneo");

    if (typeof Html5Qrcode === "undefined") {
        estado.textContent = "No se pudo cargar la biblioteca de lectura QR.";
        return;
    }

    botonActivar.disabled = true;
    estado.textContent = "Iniciando lector QR...";

    try {
        if (!lectorQR) {
            lectorQR = new Html5Qrcode("lector-qr");
        }

        qrDetectado = false;

        await lectorQR.start(
            { facingMode: "environment" },
            {
                fps: 10,
                qrbox: {
                    width: 230,
                    height: 230
                },
                aspectRatio: 4 / 3
            },

            // Se ejecuta cuando se detecta un QR
            (textoQR) => {
                if (qrDetectado) return;

                qrDetectado = true;

                console.log("FINTECH: código QR detectado:", textoQR);

                estado.textContent =
                    "Código QR leído correctamente. Revisa la consola.";

                detenerCamara();
            },

            // Errores normales mientras busca un código
            () => {}
        );

        mensaje.classList.add("oculto");
        marco.classList.add("visible");

        botonActivar.disabled = true;
        botonDetener.disabled = false;

        estado.textContent =
            "Cámara activa. Coloca el código QR dentro del recuadro.";

    } catch (error) {
        console.error("Error al iniciar el lector QR:", error);

        estado.textContent =
            "No se pudo activar la cámara. Revisa los permisos del navegador.";

        botonActivar.disabled = false;
        botonDetener.disabled = true;
    }
}

async function detenerCamara() {
    const mensaje = document.getElementById("mensaje-camara");
    const estado = document.getElementById("estado-camara");
    const botonActivar = document.getElementById("btn-activar-camara");
    const botonDetener = document.getElementById("btn-detener-camara");
    const marco = document.querySelector(".marco-escaneo");

    if (lectorQR && lectorQR.isScanning) {
        try {
            await lectorQR.stop();
        } catch (error) {
            console.error("Error al detener el lector QR:", error);
        }
    }

    if (marco) {
        marco.classList.remove("visible");
    }

    if (mensaje) {
        mensaje.classList.remove("oculto");
    }

    if (botonActivar) {
        botonActivar.disabled = false;
    }

    if (botonDetener) {
        botonDetener.disabled = true;
    }

    if (estado && !qrDetectado) {
        estado.textContent = "La cámara está desactivada.";
    }
}

// Apagar la cámara al abandonar la sección o cerrar la página.
window.addEventListener("pagehide", detenerCamara);