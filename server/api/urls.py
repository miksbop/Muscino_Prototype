from django.urls import path
from . import views

urlpatterns = [
    path('songs/', views.songs_list, name='songs_list'),
    path('sleeves/', views.sleeves_list, name='sleeves_list'),
    path('inventory/', views.inventory_list, name='inventory_list'),
    path('sleeves/<str:sleeve_id>/open', views.open_sleeve, name='open_sleeve'),
]
