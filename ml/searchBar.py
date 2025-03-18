import pymongo
import numpy as np
from pymongo import MongoClient

uri = "mongodb+srv://pratikkhodka137:Khodka@cluster0.3nkyf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
connection = MongoClient(uri)
db = connection.test

collection1 = db.userwithcats
collection1List=collection1.find()
collection2 = db.placeupdates
collection2List=collection2.find()

import pandas as pd
userList=pd.DataFrame(list(collection1.find()))
userList

placeList=pd.DataFrame(list(collection2.find()))
placeList

placeList

placeList['tags']=placeList['para']+placeList['category']+placeList['heading']
placeList.category[100]

from sklearn.feature_extraction.text import CountVectorizer
cv=CountVectorizer(max_features=5000,stop_words='english')

vectors=cv.fit_transform(placeList['tags']).toarray()
vectors

cv.get_feature_names_out()
import nltk #natural language processing library
from nltk.stem.porter import PorterStemmer
ps=PorterStemmer()

def stem(text):
    y=[]

    for i in text.split():
        y.append(ps.stem(i))
    return " ".join(y)
placeList['tags'].apply(stem)

from sklearn.metrics.pairwise import cosine_similarity
similarity= cosine_similarity(vectors)
similarity[0].shape
sorted(list(enumerate(similarity[0])),reverse=True,key=lambda x:x[1])[1:6]#pehle place ka har ek  place ke sath similarity

def recommend(partial_heading):
    """
    Recommend up to 6 related places based on a partial heading match, including the matched place.
    
    Args:
        partial_heading (str): The starting alphabets of the place heading to base recommendations on.
        
    Returns:
        list: A list of dictionaries with up to 6 recommended places (including the matched place).
        
    Raises:
        ValueError: If no heading matches the partial input.
    """
    # Convert partial heading to lowercase for case-insensitive matching
    partial_heading = partial_heading.lower()

    # Find all headings that start with the partial input
    matching_headings = [heading for heading in placeList['heading'] if heading.lower().startswith(partial_heading)]
    
    # If no matches are found, raise an error
    if not matching_headings:
        raise ValueError(f"No headings found starting with '{partial_heading}' in DataFrame")

    # For simplicity, select the first matching heading (or you can add logic to handle multiple matches)
    selected_heading = matching_headings[0]

    # Get the place's data and tags for the selected heading
    place_data = placeList[placeList['heading'] == selected_heading].iloc[0]
    # Clean and split tags properly
    place_tags = set(tag.strip().lower() for tag in place_data['tags'].split(",") if tag.strip()) if isinstance(place_data['tags'], str) else set()

    # Initialize recommendations with the matched place
    recommended_places = []
    seen_headings = set()
    place_count = 0

    # Add the matched place as the first recommendation
    recommended_places.append({
        "heading": place_data['heading'],
        "image": place_data['image'],
        "para": place_data['para'],
        "tags": ", ".join(tag.strip() for tag in place_data['tags'].split(",") if tag.strip()) if isinstance(place_data['tags'], str) else "",
    })
    seen_headings.add(place_data['heading'])
    place_count += 1

    # Filter places that match at least one of the place's tags (excluding the matched place)
    filtered_df = placeList[
        (placeList['heading'] != selected_heading) &
        (placeList['tags'].apply(lambda x: any(
            tag.strip().lower() in [t.strip().lower() for t in x.split(",") if t.strip()] 
            if isinstance(x, str) else False 
            for tag in place_tags
        )))
    ]

    # If no matching places are found based on tags, fall back to all other places
    if filtered_df.empty:
        filtered_df = placeList[placeList['heading'] != selected_heading]
        if filtered_df.empty:
            return recommended_places

    # Find the index of the matched heading in the DataFrame
    place_idx = placeList[placeList['heading'] == selected_heading].index[0]

    # Try using the similarity matrix for sorting
    try:
        distances = similarity[place_idx]  # Get similarity scores for the matched place
        places_list = sorted(list(enumerate(distances)), reverse=True, key=lambda x: x[1])[1:20]
    except (IndexError, KeyError, NameError):
        # Fallback: Use indices from filtered_df
        places_list = [(idx, 0) for idx in filtered_df.index]

    # Add places in order of similarity (or filtered list if similarity fails)
    for i, _ in places_list:
        if i not in placeList.index:  # Skip invalid indices
            continue
        place = placeList.iloc[i]
        if place['heading'] not in seen_headings:
            recommended_places.append({
                "heading": place['heading'],
                "image": place['image'],
                "para": place['para'],
                "tags": ", ".join(tag.strip() for tag in place['tags'].split(",") if tag.strip()) if isinstance(place['tags'], str) else "",
            })
            seen_headings.add(place['heading'])
            place_count += 1
            
            if place_count >= 6:  # Limit to 6 recommendations (including the matched place)
                return recommended_places

    return recommended_places

# Example call
recommend("Sa")