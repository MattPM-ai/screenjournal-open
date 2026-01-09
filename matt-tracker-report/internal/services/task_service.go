package services

import (
	"fmt"
	"matt-tracker-report/internal/models"
	"matt-tracker-report/internal/utils"
	"sync"
	"time"
)

// TaskService manages async report generation tasks
type TaskService struct {
	tasks map[string]*models.Task
	mutex sync.RWMutex
}

// NewTaskService creates a new task service
func NewTaskService() *TaskService {
	return &TaskService{
		tasks: make(map[string]*models.Task),
	}
}

// CreateTask creates a new task and returns it
func (s *TaskService) CreateTask(request models.GenerateReportRequest) (*models.Task, error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	taskID := utils.GenerateUUID()
	now := time.Now()

	task := &models.Task{
		ID:        taskID,
		Status:    models.TaskStatusPending,
		Request:   request,
		CreatedAt: now,
		UpdatedAt: now,
	}

	s.tasks[taskID] = task
	return task, nil
}

// GetTask retrieves a task by ID
func (s *TaskService) GetTask(taskID string) (*models.Task, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	task, exists := s.tasks[taskID]
	if !exists {
		return nil, fmt.Errorf("task not found: %s", taskID)
	}

	return task, nil
}

// UpdateTaskStatus updates the status of a task
func (s *TaskService) UpdateTaskStatus(taskID string, status models.TaskStatus) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	task, exists := s.tasks[taskID]
	if !exists {
		return fmt.Errorf("task not found: %s", taskID)
	}

	task.Status = status
	task.UpdatedAt = time.Now()
	return nil
}

// SetTaskError marks a task as failed with an error message
func (s *TaskService) SetTaskError(taskID string, err error) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	task, exists := s.tasks[taskID]
	if !exists {
		return fmt.Errorf("task not found: %s", taskID)
	}

	task.Status = models.TaskStatusFailed
	task.Error = err.Error()
	task.UpdatedAt = time.Now()
	return nil
}

// SetTaskReport stores the completed report in a task
func (s *TaskService) SetTaskReport(taskID string, report *models.Report) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	task, exists := s.tasks[taskID]
	if !exists {
		return fmt.Errorf("task not found: %s", taskID)
	}

	task.Status = models.TaskStatusCompleted
	task.Report = report
	task.UpdatedAt = time.Now()
	return nil
}

// DeleteTask removes a task from memory (after it's been stored in MongoDB)
func (s *TaskService) DeleteTask(taskID string) {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	delete(s.tasks, taskID)
}

// FindTaskByRequest finds a completed task matching the given request parameters
func (s *TaskService) FindTaskByRequest(request models.GenerateReportRequest) (*models.Task, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	// Search for a completed task with matching request parameters
	for _, task := range s.tasks {
		if task.Status == models.TaskStatusCompleted &&
			task.Request.Org == request.Org &&
			task.Request.OrgID == request.OrgID &&
			task.Request.StartDate == request.StartDate &&
			task.Request.EndDate == request.EndDate &&
			usersMatch(task.Request.Users, request.Users) {
			return task, nil
		}
	}

	return nil, fmt.Errorf("no matching task found")
}

// usersMatch checks if two user slices contain the same users (order-independent, by ID)
func usersMatch(users1, users2 []models.UserRequest) bool {
	if len(users1) != len(users2) {
		return false
	}

	// Create maps for comparison by user ID
	map1 := make(map[int]int)
	map2 := make(map[int]int)

	for _, u := range users1 {
		map1[u.ID]++
	}
	for _, u := range users2 {
		map2[u.ID]++
	}

	// Compare maps
	if len(map1) != len(map2) {
		return false
	}

	for userID, count := range map1 {
		if map2[userID] != count {
			return false
		}
	}

	return true
}

