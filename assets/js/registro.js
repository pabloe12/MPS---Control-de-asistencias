        document.getElementById('btnStartCapture').addEventListener('click', function() {
            var status = document.getElementById('captureStatus');
            status.style.display = 'block';
            status.textContent = 'Escaneando huella... Mantén el dedo en el sensor';
            status.style.color = '#0d6efd';
            setTimeout(function() {
                status.textContent = 'Huella capturada con éxito ✅';
                status.style.color = '#198754';
            }, 1400);
        });

        document.getElementById('btnCancelCapture').addEventListener('click', function() {
            var status = document.getElementById('captureStatus');
            status.style.display = 'block';
            status.textContent = 'Captura cancelada';
            status.style.color = '#dc3545';
        });