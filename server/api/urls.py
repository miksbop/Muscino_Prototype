from django.urls import path
from . import views

urlpatterns = [
    path('songs/', views.songs_list, name='songs_list'),
    path('sleeves/', views.sleeves_list, name='sleeves_list'),
    path('inventory/', views.inventory_list, name='inventory_list'),
    path('sleeves/<str:sleeve_id>/open', views.open_sleeve, name='open_sleeve'),
    path('auth/register/', views.auth_register, name='auth_register'),
    path('auth/login/', views.auth_login, name='auth_login'),
    path('auth/session/', views.auth_session, name='auth_session'),
    path('auth/logout/', views.auth_logout, name='auth_logout'),
]
