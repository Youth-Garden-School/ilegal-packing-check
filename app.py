from flask import Flask, render_template, Response, request, jsonify, url_for
import os
import json
import cv2
import numpy as np
from ultralytics import YOLO
import base64
from io import BytesIO
from PIL import Image
import time

app = Flask(__name__, static_folder='static')

# Configuration
PARKING_COORDINATE_DIR = "adminResources/parking-coordinate"
OUTPUT_DIR = "adminResources/output"
MODEL_PATH = "yolov8n.pt"

# Make sure output directory exists
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(PARKING_COORDINATE_DIR, exist_ok=True)

# Load YOLOv8 model
model = YOLO(MODEL_PATH)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/save-coordinates', methods=['POST'])
def save_coordinates():
    data = request.json
    coordinates = data.get('coordinates', [])
    filename = data.get('filename', 'mobile-camera-detect')
    
    # Save coordinates to file
    filepath = os.path.join(PARKING_COORDINATE_DIR, f"{filename}.txt")
    with open(filepath, 'w') as f:
        for coord in coordinates:
            f.write(f"{coord}\n")
    
    return jsonify({'success': True, 'filepath': filepath})

@app.route('/detect', methods=['POST'])
def detect():
    try:
        # Get the image data from request
        data = request.json
        image_data = data.get('image', '')
        parking_zones = data.get('parkingZones', [])
        
        # Convert base64 to image
        image_data = image_data.split(',')[1]
        image = Image.open(BytesIO(base64.b64decode(image_data)))
        opencv_image = np.array(image)
        opencv_image = cv2.cvtColor(opencv_image, cv2.COLOR_RGB2BGR)
        
        # Run detection
        results = model(opencv_image, verbose=False)[0]
        
        detections = []
        for result in results.boxes.data.tolist():
            x1, y1, x2, y2, conf, cls = result
            
            # Only include car (class 2), truck (class 7), and bus (class 5)
            if int(cls) in [2, 5, 7] and conf > 0.4:
                detections.append({
                    'x1': int(x1),
                    'y1': int(y1),
                    'x2': int(x2),
                    'y2': int(y2),
                    'conf': float(conf),
                    'class': int(cls)
                })
        
        # Check for vehicles in parking zones
        parking_status = []
        for zone in parking_zones:
            zone_status = {'occupied': False}
            for det in detections:
                # Use the same intersection logic as in main.py
                car_x = (det['x1'] + det['x2']) / 2
                car_y = (det['y1'] + det['y2']) / 2
                car_w = det['x2'] - det['x1']
                car_h = det['y2'] - det['y1']
                
                # Zone coordinates
                zone_x1, zone_y1, zone_x2, zone_y2 = zone
                
                # Check intersection
                car_x1 = max(det['x1'], 0)
                car_y1 = max(det['y1'], 0)
                car_x2 = det['x2']
                car_y2 = det['y2']
                
                overlap_x1 = max(car_x1, zone_x1)
                overlap_y1 = max(car_y1, zone_y1)
                overlap_x2 = min(car_x2, zone_x2)
                overlap_y2 = min(car_y2, zone_y2)
                
                if overlap_x1 < overlap_x2 and overlap_y1 < overlap_y2:
                    overlap_area = (overlap_x2 - overlap_x1) * (overlap_y2 - overlap_y1)
                    car_area = (car_x2 - car_x1) * (car_y2 - car_y1)
                    if overlap_area / car_area > 0.3:
                        zone_status['occupied'] = True
                        break
            
            parking_status.append(zone_status)
        
        return jsonify({
            'success': True,
            'detections': detections,
            'parkingStatus': parking_status,
            'timestamp': time.time()
        })
    
    except Exception as e:
        print(f"Error in detection: {e}")
        return jsonify({'success': False, 'error': str(e)})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)