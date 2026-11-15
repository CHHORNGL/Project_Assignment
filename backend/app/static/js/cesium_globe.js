/* global Cesium */
(function () {
    function buildViewer(containerId, options) {
        var opts = options || {};
        var useIon = Boolean(opts.token);

        if (useIon) {
            Cesium.Ion.defaultAccessToken = opts.token;
        }

        var viewer = new Cesium.Viewer(containerId, {
            animation: false,
            timeline: false,
            geocoder: false,
            baseLayerPicker: false,
            sceneModePicker: false,
            navigationHelpButton: false,
            fullscreenButton: true,
            homeButton: true
        });
        viewer.scene.backgroundColor = Cesium.Color.BLACK;
        viewer.scene.globe.baseColor = Cesium.Color.BLACK;
        viewer.scene.globe.enableLighting = true;
        viewer.scene.globe.showGroundAtmosphere = true;
        viewer.scene.skyAtmosphere.show = true;
        viewer.scene.skyBox.show = true;

        // Imagery layers (prefer Cesium Ion, fallback to OSM tiles)
        viewer.imageryLayers.removeAll();

        var container = document.getElementById(containerId);
        function showTileBlock(message) {
            if (container) {
                container.innerHTML = '<div class="globe-fallback">' + message + "</div>";
            }
        }

        function addLayer(provider) {
            var layer = viewer.imageryLayers.addImageryProvider(provider);
            if (provider && provider.errorEvent && provider.errorEvent.addEventListener) {
                provider.errorEvent.addEventListener(function () {
                    showTileBlock("Map tiles blocked. Allow tile servers or use a different network.");
                });
            }
            return layer;
        }

        function addFallbackOsm() {
            var osmProvider = new Cesium.UrlTemplateImageryProvider({
                url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
                credit: "© OpenStreetMap contributors"
            });
            addLayer(osmProvider);
        }

        if (useIon && Cesium.IonImageryProvider) {
            var ionPromise;
            if (typeof Cesium.IonImageryProvider.fromAssetId === "function") {
                ionPromise = Cesium.IonImageryProvider.fromAssetId(2);
            } else {
                ionPromise = Promise.resolve(new Cesium.IonImageryProvider({ assetId: 2 }));
            }

            ionPromise
                .then(function (ionProvider) {
                    addLayer(ionProvider);
                })
                .catch(function () {
                    addFallbackOsm();
                });
        } else {
            addFallbackOsm();
        }

        return viewer;
    }

    function addMarker(viewer, point, color) {
        return viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(point.lng, point.lat),
            point: {
                pixelSize: 10,
                color: color,
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 2
            },
            label: point.label
                ? {
                    text: point.label,
                    font: "12px sans-serif",
                    fillColor: Cesium.Color.WHITE,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2,
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    pixelOffset: new Cesium.Cartesian2(0, -22)
                }
                : undefined
        });
    }

    window.initAgroGlobe = function initAgroGlobe(containerId, options) {
        var opts = options || {};
        if (!window.Cesium) {
            var container = document.getElementById(containerId);
            if (container) {
                container.innerHTML = '<div class="globe-fallback">3D map failed to load. Check internet access or Cesium CDN.</div>';
            }
            return null;
        }
        var pickEntity = null;
        var viewer = buildViewer(containerId, opts);
        viewer.scene.globe.depthTestAgainstTerrain = true;

        if (Array.isArray(opts.points)) {
            opts.points.forEach(function (p) {
                addMarker(viewer, p, Cesium.Color.fromCssColorString("#2563eb"));
            });
            if (opts.points.length > 0) {
                viewer.flyTo(viewer.entities);
            }
        }

        var handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        handler.setInputAction(function (movement) {
            var cartesian = viewer.scene.pickPosition(movement.position);
            if (!cartesian) {
                cartesian = viewer.camera.pickEllipsoid(
                    movement.position,
                    viewer.scene.globe.ellipsoid
                );
            }
            if (!cartesian) return;

            var cartographic = Cesium.Cartographic.fromCartesian(cartesian);
            var lat = Cesium.Math.toDegrees(cartographic.latitude);
            var lng = Cesium.Math.toDegrees(cartographic.longitude);

            if (pickEntity) {
                viewer.entities.remove(pickEntity);
            }

            pickEntity = addMarker(
                viewer,
                { lat: lat, lng: lng, label: "Selected" },
                Cesium.Color.fromCssColorString("#10b981")
            );

            if (typeof opts.onPick === "function") {
                opts.onPick({ lat: lat, lng: lng });
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        return viewer;
    };
})();
