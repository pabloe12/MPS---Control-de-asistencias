          (function () {
            const images = [
                '/media/img/wall1.jpeg',
                '/media/img/wall2.jpeg',
                '/media/img/wall3.jpeg',
                '/media/img/wall4.jpeg',
                '/media/img/wall5.jpeg',
                '/media/img/wall6.jpeg',
                '/media/img/wall7.jpeg',
                '/media/img/wall8.jpeg',
                '/media/img/wall9.jpeg'
            ];

            const layer1 = document.getElementById('wallpaperLayer1');
            const layer2 = document.getElementById('wallpaperLayer2');
            let currentIndex = 0;
            let activeLayer = 1;

            function setLayerBackground(layer, imageUrl) {
                layer.style.backgroundImage = `url('${imageUrl}')`;
            }

            function swapBackground() {
                const nextIndex = (currentIndex + 1) % images.length;
                const nextImage = images[nextIndex];

                if (activeLayer === 1) {
                    setLayerBackground(layer2, nextImage);
                    layer2.classList.add('active');
                    layer1.classList.remove('active');
                    activeLayer = 2;
                } else {
                    setLayerBackground(layer1, nextImage);
                    layer1.classList.add('active');
                    layer2.classList.remove('active');
                    activeLayer = 1;
                }

                currentIndex = nextIndex;
            }

            // Inicializar con la primera imagen
            setLayerBackground(layer1, images[currentIndex]);
            setLayerBackground(layer2, images[(currentIndex + 1) % images.length]);

            // Cambiar cada 1 minuto
            setInterval(swapBackground, 30000);
        })();
    