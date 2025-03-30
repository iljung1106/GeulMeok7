import os
import json
import google.generativeai as genai
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

# Ensure data directory exists
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
CONFIG_FILE = os.path.join(DATA_DIR, 'config.json')
TEMPLATES_DIR = os.path.join(DATA_DIR, 'templates')

if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)
if not os.path.exists(TEMPLATES_DIR):
    os.makedirs(TEMPLATES_DIR)

# Default configuration
DEFAULT_CONFIG = {
    'api_key': '',
    'model': 'gemini-pro',
    'secondary_model': 'gemini-2.0-flash',  # Added secondary model
    'temperature': 0.7,
    'top_p': 0.95,
    'file_order': []  # Store the custom file order
}

# Load or create configuration
def load_config():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    else:
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(DEFAULT_CONFIG, f, indent=4)
        return DEFAULT_CONFIG

# Save configuration
def save_config(config):
    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=4)

# Initialize AI model
def initialize_ai(api_key, model_name):
    genai.configure(api_key=api_key)
    return genai.GenerativeModel(model_name)

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/config', methods=['GET', 'POST'])
def config():
    if request.method == 'GET':
        return jsonify(load_config())
    elif request.method == 'POST':
        new_config = request.json
        save_config(new_config)
        return jsonify({"status": "success"})

@app.route('/api/files', methods=['GET'])
def list_files():
    config = load_config()
    all_files = [f for f in os.listdir(DATA_DIR) if f.endswith('.txt')]
    
    # Apply custom ordering if available
    ordered_files = []
    file_order = config.get('file_order', [])
    
    # First add files in the custom order
    for filename in file_order:
        if filename in all_files:
            ordered_files.append(filename)
            all_files.remove(filename)
    
    # Then add any remaining files
    ordered_files.extend(all_files)
    
    return jsonify(ordered_files)

@app.route('/api/files/order', methods=['POST'])
def update_file_order():
    data = request.json
    new_order = data.get('order', [])
    
    # Validate that all files exist
    for filename in new_order:
        file_path = os.path.join(DATA_DIR, filename)
        if not os.path.exists(file_path):
            return jsonify({"error": f"File {filename} not found"}), 404
    
    # Update config
    config = load_config()
    config['file_order'] = new_order
    save_config(config)
    
    return jsonify({"status": "success"})

@app.route('/api/files/<filename>', methods=['GET', 'POST', 'DELETE'])
def manage_file(filename):
    file_path = os.path.join(DATA_DIR, filename)
    
    if request.method == 'GET':
        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8') as f:
                return jsonify({"content": f.read()})
        return jsonify({"error": "File not found"}), 404
    
    elif request.method == 'POST':
        content = request.json.get('content', '')
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return jsonify({"status": "success"})
    
    elif request.method == 'DELETE':
        if os.path.exists(file_path):
            os.remove(file_path)
            return jsonify({"status": "success"})
        return jsonify({"error": "File not found"}), 404

@app.route('/api/templates', methods=['GET'])
def list_templates():
    templates = []
    if os.path.exists(TEMPLATES_DIR):
        templates = [f for f in os.listdir(TEMPLATES_DIR) if f.endswith('.json')]
    return jsonify(templates)

@app.route('/api/templates/<template_name>', methods=['GET', 'POST', 'DELETE'])
def manage_template(template_name):
    template_path = os.path.join(TEMPLATES_DIR, template_name)
    
    if request.method == 'GET':
        if os.path.exists(template_path):
            with open(template_path, 'r', encoding='utf-8') as f:
                return jsonify(json.load(f))
        return jsonify({"error": "Template not found"}), 404
    
    elif request.method == 'POST':
        template_data = request.json
        with open(template_path, 'w', encoding='utf-8') as f:
            json.dump(template_data, f, ensure_ascii=False, indent=4)
        return jsonify({"status": "success"})
    
    elif request.method == 'DELETE':
        if os.path.exists(template_path):
            os.remove(template_path)
            return jsonify({"status": "success"})
        return jsonify({"error": "Template not found"}), 404

@app.route('/api/generate', methods=['POST'])
def generate():
    data = request.json
    config = load_config()
    
    if not config['api_key']:
        return jsonify({"error": "API key not set"}), 400
    
    try:
        # Initialize AI models
        main_model = initialize_ai(config['api_key'], config['model'])
        secondary_model = initialize_ai(config['api_key'], config['secondary_model'])
        
        # Prepare prompt
        system_instructions = data.get('system_instructions', '')
        upper_prompt = data.get('upper_prompt', '')
        main_prompt = data.get('main_prompt', '')
        lower_prompt = data.get('lower_prompt', '')
        
        # Process regular context files
        file_contents = []
        for filename in data.get('selected_files', []):
            file_path = os.path.join(DATA_DIR, filename)
            if os.path.exists(file_path):
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    file_contents.append(f"=== {filename} ===\n{content}\n\n")
        
        # Process summarized context files
        summarized_file_contents = []
        for filename in data.get('selected_summarized_files', []):
            file_path = os.path.join(DATA_DIR, filename)
            if os.path.exists(file_path):
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                    # Create summarization prompt for secondary model
                    summary_prompt = f"""Please provide a concise summary of the following content:

{content}

Your summary should capture the main points, key events, and important details while being significantly shorter than the original text."""
                    
                    # Generate summary with secondary model
                    summary_generation_config = {
                        "temperature": 0.3,  # Lower temperature for more focused summary
                        "top_p": 0.95,
                        "max_output_tokens": 2048,
                    }
                    
                    summary_response = secondary_model.generate_content(
                        summary_prompt,
                        generation_config=summary_generation_config
                    )
                    
                    # Add the summary to the context
                    summarized_file_contents.append(f"=== 요약된 {filename} ===\n{summary_response.text}\n\n")
        
        # Combine regular and summarized context
        file_context = "\n".join(file_contents)
        summarized_context = "\n".join(summarized_file_contents)
        
        # Construct the full prompt
        full_prompt = f"{system_instructions}\n\n"
        
        if summarized_context:
            full_prompt += f"요약된 컨텍스트:\n{summarized_context}\n\n"
            
        if file_context:
            full_prompt += f"컨텍스트:\n{file_context}\n\n"
            
        if upper_prompt:
            full_prompt += f"{upper_prompt}\n\n"
            
        full_prompt += main_prompt
        
        if lower_prompt:
            full_prompt += f"\n\n{lower_prompt}"
        
        # Generate content with main model
        generation_config = {
            "temperature": float(config['temperature']),
            "top_p": float(config['top_p']),
            "max_output_tokens": 8192,
        }
        
        response = main_model.generate_content(
            full_prompt,
            generation_config=generation_config
        )
        
        return jsonify({"response": response.text})
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/summarize', methods=['POST'])
def summarize():
    data = request.json
    filename = data.get('filename')
    config = load_config()
    
    if not config['api_key']:
        return jsonify({"error": "API key not set"}), 400
    
    if not filename:
        return jsonify({"error": "Filename not provided"}), 400
    
    file_path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(file_path):
        return jsonify({"error": "File not found"}), 404
    
    try:
        # Initialize AI
        model = initialize_ai(config['api_key'], config['model'])
        
        # Read file content
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Create summarization prompt
        summary_prompt = f"""Please provide a concise summary of the following content:

{content}

Your summary should capture the main points, key events, and important details while being significantly shorter than the original text."""
        
        # Generate summary
        generation_config = {
            "temperature": 0.3,  # Lower temperature for more focused summary
            "top_p": 0.95,
            "max_output_tokens": 4096,
        }
        
        response = model.generate_content(
            summary_prompt,
            generation_config=generation_config
        )
        
        # Create summary filename
        base_name = os.path.splitext(filename)[0]
        summary_filename = f"summary_of_{base_name}.txt"
        summary_path = os.path.join(DATA_DIR, summary_filename)
        
        # Save summary
        with open(summary_path, 'w', encoding='utf-8') as f:
            f.write(response.text)
        
        return jsonify({
            "status": "success", 
            "summary": response.text,
            "summary_filename": summary_filename
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
