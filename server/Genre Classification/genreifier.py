#AC
# Music Genre Classifier Module
# When given a file path to an mp3 file, it uses the model to predict the genre and returns it as a string.
# Assumes that model file is in same directory as this script, and that 

#THINGS TO INSTALL on computer TO USE (DELETE LATER):
#librosa, tensorflow, numpy

import os
import librosa
import numpy as np
import tensorflow as tf
from tensorflow.image import resize


# Load the model from current directory
os.chdir(os.path.dirname(os.path.abspath(__file__)))
model = tf.keras.models.load_model("Trained_model.keras")

# Define Genres
genres = ['blues', 'classical', 'country', 'disco', 'hiphop', 'jazz', 'metal', 'pop', 'reggae', 'rock']

#Preprocess Audio
def load_and_preprocess_audio(file_path, target_shape=(150,150)):
    data=[]
    
    audio_data, sample_rate = librosa.load(file_path, sr=None)
    #Define duration of chunk / overlap in seconds
    chunk_duration = 4 
    overlap_duration = 2

    #Convert Durations to samples
    chunk_samples = chunk_duration * sample_rate
    overlap_samples = overlap_duration * sample_rate

    #Calculate Number of chunks
    num_chunks = int(np.ceil((len(audio_data) - chunk_samples) / (chunk_samples - overlap_samples))) + 1

    #Iterate over each chunk
    for i in range(num_chunks):
        #Calculate start and end of chunk
        start = i * (chunk_samples - overlap_samples)
        end = start + chunk_samples

        #Extract chunk of audio 
        chunk = audio_data[start:end]

        #Compute Melspectrogram for chunk
        mel_spectrogram = librosa.feature.melspectrogram(y=chunk, sr=sample_rate)
        
        mel_spectrogram = resize(np.expand_dims(mel_spectrogram, axis=-1), target_shape)
        data.append(mel_spectrogram)
    return np.array(data)

def model_predict(X_test):
    y_pred= model.predict(X_test)
    predicted_classes = np.argmax(y_pred, axis=1)
    unique_elements, counts =  np.unique(predicted_classes, return_counts=True)
    max_count=np.max(counts)
    max_elements=unique_elements[counts == max_count]
    return max_elements[0]

def predict_genre(file_path):
    X_test =load_and_preprocess_audio(file_path)
    genre_i = model_predict(X_test)
    return genres[genre_i]

if __name__ == "__main__":
    #Test that the classifier works
    print(f"Model Prediction :: Music Genre --> {predict_genre('./test_music/test.mp3')}")


