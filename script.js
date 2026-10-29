document.addEventListener("DOMContentLoaded", iniciarPagina);

function iniciarPagina() {
    configurarNavegacion();
    configurarBusqueda();
    configurarFormulario();
    configurarCamara();
}

// CAMBIO ENTRE LAS TRES SECCIONES
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

            // Detiene la cámara al abandonar su sección.
            if (destino !== "camara") {
                detenerCamara();
            }
        });
    });
}

// BÚSQUEDA: TODAVÍA SIN CONEXIÓN A LOS PARTICIPANTES
function configurarBusqueda() {
    const formulario = document.getElementById("form-busqueda");
    const campo = document.getElementById("busqueda");
    const resultado = document.getElementById("resultado-busqueda");

    formulario.addEventListener("submit", (evento) => {
        evento.preventDefault();

        const consulta = campo.value.trim();

        if (!consulta) {
            campo.focus();
            return;
        }

        resultado.replaceChildren();

        const titulo = document.createElement("p");
        titulo.className = "mensaje-titulo";
        titulo.textContent = "Búsqueda preparada";

        const descripcion = document.createElement("p");
        descripcion.textContent =
            "La búsqueda de participantes estará disponible cuando conectemos Google Sheets.";

        resultado.append(titulo, descripcion);
    });
}

// FORMULARIO: TODAVÍA SIN ENVÍO REAL
function configurarFormulario() {
    const formulario = document.getElementById("form-nuevo-registro");
    const mensaje = document.getElementById("mensaje-registro");

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

// CÁMARA
let flujoCamara = null;

function configurarCamara() {
    const botonActivar = document.getElementById("btn-activar-camara");
    const botonDetener = document.getElementById("btn-detener-camara");

    botonActivar.addEventListener("click", activarCamara);
    botonDetener.addEventListener("click", detenerCamara);
}

async function activarCamara() {
    const video = document.getElementById("video-camara");
    const mensaje = document.getElementById("mensaje-camara");
    const estado = document.getElementById("estado-camara");
    const botonActivar = document.getElementById("btn-activar-camara");
    const botonDetener = document.getElementById("btn-detener-camara");
    const marco = document.querySelector(".marco-escaneo");

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        estado.textContent =
            "Tu navegador no permite acceder a la cámara en esta dirección. Utiliza HTTPS o prueba en localhost.";
        return;
    }

    botonActivar.disabled = true;
    estado.textContent = "Solicitando permiso para utilizar la cámara...";

    try {
        flujoCamara = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                facingMode: { ideal: "environment" }
            }
        });

        video.srcObject = flujoCamara;
        await video.play();

        video.classList.add("visible");
        mensaje.classList.add("oculto");
        marco.classList.add("visible");

        botonActivar.disabled = true;
        botonDetener.disabled = false;

        estado.textContent =
            "Cámara activa. La lectura automática del código QR se implementará después.";
    } catch (error) {
        detenerCamara();

        if (error.name === "NotAllowedError" ||
            error.name === "PermissionDeniedError") {
            estado.textContent =
                "No se concedió permiso para utilizar la cámara. Revisa los permisos del navegador.";
        } else if (error.name === "NotFoundError") {
            estado.textContent =
                "No se encontró una cámara disponible en este dispositivo.";
        } else {
            estado.textContent =
                "No se pudo activar la cámara. Comprueba los permisos e inténtalo de nuevo.";
        }
    } finally {
        if (!flujoCamara) {
            botonActivar.disabled = false;
        }
    }
}

function detenerCamara() {
    const video = document.getElementById("video-camara");
    const mensaje = document.getElementById("mensaje-camara");
    const estado = document.getElementById("estado-camara");
    const botonActivar = document.getElementById("btn-activar-camara");
    const botonDetener = document.getElementById("btn-detener-camara");
    const marco = document.querySelector(".marco-escaneo");

    if (flujoCamara) {
        flujoCamara.getTracks().forEach((pista) => pista.stop());
        flujoCamara = null;
    }

    if (video) {
        video.pause();
        video.srcObject = null;
        video.classList.remove("visible");
    }

    if (mensaje) {
        mensaje.classList.remove("oculto");
    }

    if (marco) {
        marco.classList.remove("visible");
    }

    if (botonActivar) {
        botonActivar.disabled = false;
    }

    if (botonDetener) {
        botonDetener.disabled = true;
    }

    if (estado) {
        estado.textContent = "La cámara está desactivada.";
    }
}

// Apaga la cámara si se abandona o cierra la página.
window.addEventListener("pagehide", detenerCamara);