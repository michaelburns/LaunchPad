using LaunchPad.Models;
using Microsoft.AspNetCore.Mvc.Rendering;
using System.Collections.Generic;

namespace LaunchPad.ViewModels
{
    public class AdminViewModel
    {
        public User User { get; set; }
        public IEnumerable<int> SelectedRoles { get; set; }
        public SelectList AvailableRoles { get; set; }
        public IEnumerable<int> SelectedCategories { get; set; }
        public SelectList AvailableCategories { get; set; }
    }
}
