using LaunchPad.Models;
using Microsoft.AspNetCore.Mvc.Rendering;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace LaunchPad.ViewModels
{
    public class AdminViewModel
    {
        public User User { get; set; }
        [Required(ErrorMessage = "A role is required")]
        public IEnumerable<int> SelectedRoles { get; set; }
        public SelectList AvailableRoles { get; set; }
        [Required(ErrorMessage = "A category is required")]
        public IEnumerable<int> SelectedCategories { get; set; }
        public SelectList AvailableCategories { get; set; }
    }
}
